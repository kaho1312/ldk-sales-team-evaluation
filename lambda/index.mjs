import { createPool } from 'mysql2/promise';
import { createHmac, scrypt, randomBytes, timingSafeEqual, randomUUID } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'ldk-quiz-secret-change-in-prod';
const JWT_TTL = 60 * 60 * 24 * 7; // 7 days

const ADMIN_EMAILS = new Set(['kay@ldk.lat', 'fernanda@ldk.lat', 'joaquin.g@ldk.lat']);

// ── DB pool ───────────────────────────────────────────────────────────────────

let pool;
function db() {
  if (!pool) pool = createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ldk_quiz',
    waitForConnections: true,
    connectionLimit: 5,
    ssl: { rejectUnauthorized: false },
  });
  return pool;
}

// ── JWT ───────────────────────────────────────────────────────────────────────

function signToken(payload) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const b = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + JWT_TTL })).toString('base64url');
  const s = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [h, b, s] = token.split('.');
    if (createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url') !== s) return null;
    const p = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}

// ── Password ──────────────────────────────────────────────────────────────────

async function hashPwd(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(pw, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function checkPwd(pw, stored) {
  const [salt, hash] = stored.split(':');
  const derived = await scryptAsync(pw, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), derived);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

const ok = (data, code = 200) => ({ statusCode: code, headers: CORS, body: JSON.stringify(data) });
const fail = (msg, code = 400) => ({ statusCode: code, headers: CORS, body: JSON.stringify({ message: msg }) });

function calcScore(answers, totalQuestions, passingThreshold = 0.9) {
  const minCorrect = Math.ceil(totalQuestions * passingThreshold);
  const maxErr = Math.floor(totalQuestions * 0.1);
  const errs = { A: 0, B: 0, C: 0 };
  let correct = 0;
  for (const a of answers) {
    if (a.final_grade) { correct++; }
    else { const s = a.section === 'All' ? 'A' : a.section; if (s in errs) errs[s]++; }
  }
  const pct = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  const reasons = [];
  if (correct < minCorrect) reasons.push(`Puntaje ${pct}% por debajo del 90%`);
  for (const [s, e] of Object.entries(errs)) if (e > maxErr) reasons.push(`Sección ${s}: ${e} errores`);
  return { correct, pct, errs, passed: reasons.length === 0, reasons };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const rawPath = event.path || event.rawPath || '/';
  const seg = rawPath.replace(/^\//, '').split('/');
  const q = event.queryStringParameters || {};
  let body = {};
  if (event.body) {
    try { body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body; } catch {}
  }

  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const claims = verifyToken(token);
  const conn = db();

  try {
    // ── POST /auth/register ────────────────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'auth' && seg[1] === 'register') {
      const { email, password, full_name } = body;
      if (!email || !password || !full_name) return fail('Email, contraseña y nombre son requeridos');
      if (!email.toLowerCase().endsWith('@ldk.lat')) return fail('Solo correos @ldk.lat son permitidos');
      if (password.length < 6) return fail('La contraseña debe tener al menos 6 caracteres');

      const norm = email.toLowerCase().trim();
      const [ex] = await conn.query('SELECT id FROM users WHERE email = ?', [norm]);
      if (ex.length) return fail('Este correo ya está registrado');

      const id = randomUUID();
      const hash = await hashPwd(password);
      const isAdmin = ADMIN_EMAILS.has(norm) ? 1 : 0;
      await conn.query('INSERT INTO users (id, email, full_name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)', [id, norm, full_name.trim(), hash, isAdmin]);
      const jwt = signToken({ sub: id, email: norm });
      return ok({ token: jwt, user: { id, email: norm, full_name: full_name.trim(), is_admin: !!isAdmin } }, 201);
    }

    // ── POST /auth/login ───────────────────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'auth' && seg[1] === 'login') {
      const { email, password } = body;
      if (!email || !password) return fail('Email y contraseña requeridos');
      const norm = email.toLowerCase().trim();
      const [rows] = await conn.query('SELECT * FROM users WHERE email = ?', [norm]);
      if (!rows.length || !rows[0].password_hash) return fail('Correo o contraseña incorrectos', 401);
      if (!await checkPwd(password, rows[0].password_hash)) return fail('Correo o contraseña incorrectos', 401);
      await conn.query('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
      const jwt = signToken({ sub: rows[0].id, email: rows[0].email });
      return ok({ token: jwt, user: { id: rows[0].id, email: rows[0].email, full_name: rows[0].full_name, is_admin: !!rows[0].is_admin } });
    }

    // All routes below require auth
    if (!claims) return fail('Unauthorized', 401);

    // ── GET /me ────────────────────────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'me') {
      const [rows] = await conn.query('SELECT id, email, full_name, is_admin, created_at, last_login FROM users WHERE id = ?', [claims.sub]);
      if (!rows.length) return fail('User not found', 404);
      return ok(rows[0]);
    }

    // ── POST /attempts ─────────────────────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'attempts' && seg.length === 1) {
      const { userId, tier } = body;
      const uid = userId || claims.sub;
      const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM quiz_attempts WHERE user_id = ? AND certification_tier = ?', [uid, tier.toLowerCase()]);
      const id = randomUUID();
      await conn.query('INSERT INTO quiz_attempts (id, user_id, certification_tier, attempt_number, status) VALUES (?, ?, ?, ?, ?)', [id, uid, tier.toLowerCase(), cnt + 1, 'in_progress']);
      return ok({ id }, 201);
    }

    // ── GET /attempts/active ───────────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'attempts' && seg[1] === 'active') {
      const uid = q.userId || claims.sub;
      // Prefer the in-progress attempt with the most saved answers so an empty
      // attempt created by accident doesn't shadow one with real progress.
      const [rows] = await conn.query(
        `SELECT qa.* FROM quiz_attempts qa
         LEFT JOIN (SELECT attempt_id, COUNT(*) AS cnt FROM answers GROUP BY attempt_id) ac ON qa.id = ac.attempt_id
         WHERE qa.user_id = ? AND qa.certification_tier = ? AND qa.status = 'in_progress'
         ORDER BY COALESCE(ac.cnt, 0) DESC, qa.started_at DESC
         LIMIT 1`,
        [uid, (q.tier || 'junior').toLowerCase()]
      );
      return ok(rows[0] || null);
    }

    // ── GET /attempts/:id/answers (own attempt — for break/resume) ────────────
    if (method === 'GET' && seg[0] === 'attempts' && seg[2] === 'answers') {
      const [[attempt]] = await conn.query('SELECT user_id FROM quiz_attempts WHERE id = ?', [seg[1]]);
      if (!attempt || attempt.user_id !== claims.sub) return fail('Forbidden', 403);
      const [rows] = await conn.query(
        'SELECT question_id, section, ai_grade FROM answers WHERE attempt_id = ? ORDER BY created_at ASC',
        [seg[1]]
      );
      return ok(rows);
    }

    // ── POST /attempts/:id/answers ─────────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'attempts' && seg[2] === 'answers') {
      const { questionId, section, userAnswer, aiGrade, aiReasoning } = body;
      const id = randomUUID();
      await conn.query(
        'INSERT INTO answers (id, attempt_id, question_id, section, user_answer, ai_grade, ai_reasoning) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE user_answer=VALUES(user_answer), ai_grade=VALUES(ai_grade), ai_reasoning=VALUES(ai_reasoning)',
        [id, seg[1], questionId, section, userAnswer, aiGrade ? 1 : 0, aiReasoning || null]
      );
      return ok({ ok: true });
    }

    // ── POST /attempts/:id/complete ────────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'attempts' && seg[2] === 'complete') {
      const { total_questions, passing_threshold } = body;
      const [answers] = await conn.query('SELECT section, final_grade FROM answers WHERE attempt_id = ?', [seg[1]]);
      const { correct, pct, errs, passed, reasons } = calcScore(answers, total_questions, passing_threshold);
      await conn.query('UPDATE quiz_attempts SET status=?, total_correct=?, total_questions=?, section_errors=?, score_percent=?, completed_at=NOW() WHERE id=?', [passed ? 'passed' : 'failed', correct, total_questions, JSON.stringify(errs), pct, seg[1]]);
      return ok({ total_correct: correct, total_questions, score_percent: pct, section_errors: errs, passed, fail_reasons: reasons });
    }

    // ── GET /users/:id/certifications ──────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'certifications' && !seg[3]) {
      const [rows] = await conn.query('SELECT * FROM certifications WHERE user_id = ?', [seg[1]]);
      return ok(rows);
    }

    // ── POST /users/:id/certifications ─────────────────────────────────────────
    if (method === 'POST' && seg[0] === 'users' && seg[2] === 'certifications') {
      const { tier, attemptId, grantedBy } = body;
      const id = randomUUID();
      await conn.query('INSERT INTO certifications (id, user_id, certification_tier, attempt_id, granted_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE granted_at=NOW(), granted_by=VALUES(granted_by)', [id, seg[1], tier.toLowerCase(), attemptId || null, grantedBy || 'system']);
      return ok({ ok: true }, 201);
    }

    // ── DELETE /users/:id/certifications/:tier ─────────────────────────────────
    if (method === 'DELETE' && seg[0] === 'users' && seg[2] === 'certifications' && seg[3]) {
      await conn.query('DELETE FROM certifications WHERE user_id = ? AND certification_tier = ?', [seg[1], seg[3].toLowerCase()]);
      return ok({ ok: true });
    }

    // ── GET /users/:id/progress ────────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'progress') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [summed] = await conn.query(
        `SELECT COALESCE(SUM(CASE WHEN a.final_grade = 1 THEN 1 ELSE 0 END), 0) AS correct, COUNT(*) AS total
         FROM answers a JOIN quiz_attempts qa ON qa.id = a.attempt_id
         WHERE qa.user_id = ? AND qa.certification_tier = ? AND qa.status IN ('passed', 'failed')`,
        [seg[1], tier]
      );
      const [certs] = await conn.query('SELECT id FROM certifications WHERE user_id=? AND certification_tier=?', [seg[1], tier]);
      return ok({ correct: Number(summed[0].correct), total: Number(summed[0].total), certified: certs.length > 0 });
    }

    // ── GET /users/:id/completed-sections ──────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'completed-sections') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [rows] = await conn.query(
        `SELECT DISTINCT a.section FROM answers a JOIN quiz_attempts qa ON a.attempt_id=qa.id WHERE qa.user_id=? AND qa.certification_tier=? AND qa.status!='in_progress'`,
        [seg[1], tier]
      );
      return ok(rows.map(r => r.section));
    }

    // ── GET /users/:id/active-attempts ────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'active-attempts') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [rows] = await conn.query(
        `SELECT qa.id AS attempt_id, a.section, COUNT(DISTINCT a.question_id) AS answered_count
         FROM quiz_attempts qa
         JOIN answers a ON a.attempt_id = qa.id
         WHERE qa.user_id = ? AND qa.certification_tier = ? AND qa.status = 'in_progress'
         GROUP BY qa.id, a.section
         ORDER BY answered_count DESC`,
        [seg[1], tier]
      );
      return ok(rows.map(r => ({ attemptId: r.attempt_id, section: r.section, answeredCount: Number(r.answered_count) })));
    }

    // ── GET /users/:id/section-progress ────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'section-progress') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [rows] = await conn.query(
        `SELECT a.section, COUNT(DISTINCT a.question_id) as answered
         FROM answers a JOIN quiz_attempts qa ON a.attempt_id=qa.id
         WHERE qa.user_id=? AND qa.certification_tier=?
         GROUP BY a.section`,
        [seg[1], tier]
      );
      const result = { A: 0, B: 0, C: 0 };
      for (const r of rows) if (r.section in result) result[r.section] = Number(r.answered);
      return ok(result);
    }

    // ── GET /leaderboard ───────────────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'leaderboard') {
      const [rows] = await conn.query(
        `SELECT u.id, u.full_name,
          COALESCE(MAX(qa.total_correct), 0) as correct,
          COALESCE(MAX(qa.total_questions), 0) as total,
          MAX(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) as certified
         FROM users u
         LEFT JOIN quiz_attempts qa ON qa.user_id=u.id AND qa.status='passed'
         LEFT JOIN certifications c ON c.user_id=u.id
         GROUP BY u.id, u.full_name
         ORDER BY correct DESC, u.full_name ASC`
      );
      return ok(rows.map(r => ({ ...r, certified: !!r.certified })));
    }

    // ── GET /quiz-configs ──────────────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'quiz-configs' && !seg[1]) {
      const [rows] = await conn.query('SELECT * FROM quiz_configs');
      return ok(rows);
    }

    // ── GET /quiz-configs/active ───────────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'quiz-configs' && seg[1] === 'active') {
      const [rows] = await conn.query('SELECT * FROM quiz_configs WHERE certification_tier=? AND is_active=1', [(q.tier || 'junior').toLowerCase()]);
      return ok(rows[0] || null);
    }

    // ── PUT /quiz-configs/:id ──────────────────────────────────────────────────
    if (method === 'PUT' && seg[0] === 'quiz-configs' && seg[1]) {
      const { total_questions, passing_threshold, questions_source_url, is_active } = body;
      await conn.query('UPDATE quiz_configs SET total_questions=?, passing_threshold=?, questions_source_url=?, is_active=? WHERE id=?', [total_questions, passing_threshold, questions_source_url || null, is_active ? 1 : 0, seg[1]]);
      return ok({ ok: true });
    }

    // ── Admin routes ───────────────────────────────────────────────────────────

    if (seg[0] === 'admin') {
      const [adminCheck] = await conn.query('SELECT is_admin FROM users WHERE id = ?', [claims.sub]);
      if (!adminCheck[0]?.is_admin) return fail('Forbidden', 403);

      // GET /admin/users
      if (method === 'GET' && seg[1] === 'users' && !seg[2]) {
        const [users] = await conn.query('SELECT id, email, full_name, is_admin, created_at, last_login FROM users ORDER BY created_at DESC');
        const result = await Promise.all(users.map(async (u) => {
          const [certs] = await conn.query('SELECT certification_tier, granted_at FROM certifications WHERE user_id=?', [u.id]);
          const [attempts] = await conn.query('SELECT * FROM quiz_attempts WHERE user_id=? ORDER BY started_at DESC', [u.id]);
          return { ...u, is_admin: !!u.is_admin, certifications: certs, attempts };
        }));
        return ok(result);
      }

      // PUT /admin/users/:id/admin
      if (method === 'PUT' && seg[1] === 'users' && seg[3] === 'admin') {
        await conn.query('UPDATE users SET is_admin=? WHERE id=?', [body.isAdmin ? 1 : 0, seg[2]]);
        return ok({ ok: true });
      }

      // GET /admin/attempts (all — no ID)
      if (method === 'GET' && seg[1] === 'attempts' && !seg[2]) {
        const [rows] = await conn.query('SELECT qa.*, u.email as user_email, u.full_name as user_name FROM quiz_attempts qa JOIN users u ON u.id=qa.user_id ORDER BY qa.started_at DESC');
        return ok(rows);
      }

      // GET /admin/attempts/:id
      if (method === 'GET' && seg[1] === 'attempts' && seg[2]) {
        const [rows] = await conn.query('SELECT qa.*, u.email, u.full_name FROM quiz_attempts qa JOIN users u ON u.id=qa.user_id WHERE qa.id=?', [seg[2]]);
        if (!rows.length) return fail('Not found', 404);
        const [answers] = await conn.query('SELECT * FROM answers WHERE attempt_id=?', [seg[2]]);
        const row = rows[0];
        return ok({ ...row, answers, user: { email: row.email, full_name: row.full_name } });
      }

      // POST /admin/answers/:id/override
      if (method === 'POST' && seg[1] === 'answers' && seg[3] === 'override') {
        const { override, attemptId, config } = body;
        await conn.query('UPDATE answers SET admin_override=? WHERE id=?', [override === null ? null : (override ? 1 : 0), seg[2]]);
        const [answers] = await conn.query('SELECT section, final_grade FROM answers WHERE attempt_id=?', [attemptId]);
        const { correct, pct, errs, passed, reasons } = calcScore(answers, config.total_questions, config.passing_threshold);
        await conn.query('UPDATE quiz_attempts SET status=?, total_correct=?, section_errors=?, score_percent=? WHERE id=?', [passed ? 'passed' : 'failed', correct, JSON.stringify(errs), pct, attemptId]);
        return ok({ total_correct: correct, total_questions: config.total_questions, score_percent: pct, section_errors: errs, passed, fail_reasons: reasons });
      }
    }

    return fail('Not found', 404);
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ message: 'Internal server error', detail: e.message }) };
  }
};
