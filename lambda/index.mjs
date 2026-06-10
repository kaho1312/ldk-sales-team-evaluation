import { createPool } from 'mysql2/promise';
import { createHmac, createHash, scrypt, randomBytes, timingSafeEqual, randomUUID } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'ldk-quiz-secret-change-in-prod';
const JWT_TTL = 60 * 60 * 24 * 7; // 7 days

const ADMIN_EMAILS = new Set(['kay@ldk.lat', 'fernanda@ldk.lat', 'joaquin.g@ldk.lat']);

// ── Password-reset / email (Resend) config ─────────────────────────────────────
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://quiz.ldk.fyi';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESET_FROM = process.env.RESET_FROM || 'LDK Ventas <no-reply@ldk.lat>';
const RESET_TTL_SELF = 60 * 60;          // self-service "forgot password": 1 hour
const RESET_TTL_INVITE = 60 * 60 * 72;   // admin-sent invite: 72 hours

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

// ── Password reset tokens + email ───────────────────────────────────────────────

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Create a single-use reset token for a user and return the raw token (only the
// hash is stored). Expiry is computed server-side in UTC so it's independent of the
// connection's session time zone.
async function createResetToken(conn, userId, ttlSeconds) {
  const raw = randomBytes(32).toString('hex');
  await conn.query(
    'INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))',
    [randomUUID(), userId, sha256(raw), ttlSeconds]
  );
  return raw;
}

// Send a reset link via Resend (raw fetch — no SDK/dependency). Returns true on a 2xx.
// If RESEND_API_KEY is unset it logs and returns false rather than throwing.
async function sendResetEmail(toEmail, fullName, link, kind) {
  if (!RESEND_API_KEY) { console.log('RESEND_API_KEY not set — cannot send reset email'); return false; }
  const name = (fullName || '').split(' ')[0] || '';
  const intro = kind === 'invite'
    ? 'Un administrador de LDK solicitó restablecer tu contraseña para la Certificación de Ventas.'
    : 'Recibimos una solicitud para restablecer tu contraseña de la Certificación de Ventas LDK.';
  const hours = kind === 'invite' ? 72 : 1;
  const subject = 'Restablece tu contraseña — Certificación de Ventas LDK';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
      <h2 style="color:#001344;margin-bottom:8px">Restablecer contraseña</h2>
      <p>Hola${name ? ' ' + name : ''},</p>
      <p>${intro}</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#001344;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;display:inline-block">
          Crear nueva contraseña
        </a>
      </p>
      <p style="font-size:13px;color:#475569">Este enlace caduca en ${hours} hora${hours === 1 ? '' : 's'}. Si no solicitaste esto, puedes ignorar este correo.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">Si el botón no funciona, copia este enlace:<br>${link}</p>
    </div>`;
  const text = `Restablecer contraseña\n\nHola${name ? ' ' + name : ''},\n${intro}\n\nAbre este enlace para crear una nueva contraseña (caduca en ${hours} hora${hours === 1 ? '' : 's'}):\n${link}\n\nSi no solicitaste esto, ignora este correo.`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESET_FROM, to: [toEmail], subject, html, text }),
    });
    if (!res.ok) { console.log('Resend send failed:', res.status, await res.text().catch(() => '')); return false; }
    return true;
  } catch (e) { console.log('Resend send error:', e.message); return false; }
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

// ── Cumulative certification eligibility ───────────────────────────────────────
// A tier is earned by cumulative performance across ALL of a user's completed
// attempts, NOT by any single section attempt (a single section maxes out at 28
// questions, so it can never reach 50/55). A question counts as correct if ANY
// attempt graded it correct — best-grade-wins via MAX(final_grade) over distinct
// question_ids — which naturally tolerates retakes and discarded partial attempts.
//   Pass = correct >= ceil(total*threshold) AND no section with > floor(total*0.1) errors.
async function certEligibility(conn, userId, tier) {
  const [cfg] = await conn.query(
    'SELECT total_questions, passing_threshold FROM quiz_configs WHERE certification_tier = ? AND is_active = 1',
    [tier]
  );
  const totalQuestions = cfg[0]?.total_questions || 55;
  const threshold = cfg[0]?.passing_threshold != null ? Number(cfg[0].passing_threshold) : 0.9;
  // Group by question_id ONLY (a question_id uniquely determines its section) so a
  // single question is never split into two buckets — matches the leaderboard's
  // COUNT(DISTINCT question_id) convention and is robust to any future section relabel.
  const [rows] = await conn.query(
    `SELECT a.question_id, MIN(a.section) AS section, MAX(COALESCE(a.final_grade, 0)) AS best
       FROM answers a
       JOIN quiz_attempts qa ON qa.id = a.attempt_id
      WHERE qa.user_id = ? AND qa.certification_tier = ? AND qa.status IN ('passed','failed')
      GROUP BY a.question_id`,
    [userId, tier]
  );
  const errs = { A: 0, B: 0, C: 0 };
  const sectionCorrect = { A: 0, B: 0, C: 0 };
  const sectionAnswered = { A: 0, B: 0, C: 0 };
  let correct = 0;
  for (const r of rows) {
    const s = r.section === 'All' ? 'A' : r.section;
    const inSec = s in errs;
    if (inSec) sectionAnswered[s]++;
    if (Number(r.best) === 1) { correct++; if (inSec) sectionCorrect[s]++; }
    else if (inSec) { errs[s]++; }
  }
  const minCorrect = Math.ceil(totalQuestions * threshold);
  const maxErr = Math.floor(totalQuestions * 0.1);
  const reasons = [];
  if (correct < minCorrect) reasons.push(`Puntaje general por debajo del umbral (${correct}/${minCorrect} requeridas de ${totalQuestions})`);
  for (const [s, e] of Object.entries(errs)) if (e > maxErr) reasons.push(`Sección ${s}: ${e} errores (máximo ${maxErr})`);
  return {
    correct,
    total_questions: totalQuestions,
    section_errors: errs,
    section_correct: sectionCorrect,
    section_answered: sectionAnswered,
    passed: reasons.length === 0,
    fail_reasons: reasons,
  };
}

// Grant the tier cert if cumulatively eligible and not already granted. Grant-only:
// it never auto-revokes (an admin downgrade requires an explicit DELETE), so a
// transient dip can't strip a cert. Returns eligibility + { certified, newlyGranted }
// so the client can reflect the badge and the "just earned" animation.
async function syncCertification(conn, userId, tier) {
  const cert = await certEligibility(conn, userId, tier);
  const [existing] = await conn.query(
    'SELECT id FROM certifications WHERE user_id = ? AND certification_tier = ?',
    [userId, tier]
  );
  let newlyGranted = false;
  if (cert.passed && existing.length === 0) {
    // Insert failure (e.g. transient DB error) must NOT lose the eligibility we just
    // computed — return certified based on eligibility so the client still reflects it,
    // and the next /complete or admin override re-attempts the idempotent grant.
    try {
      await conn.query(
        'INSERT INTO certifications (id, user_id, certification_tier, granted_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE granted_at = granted_at',
        [randomUUID(), userId, tier, 'system']
      );
      newlyGranted = true;
    } catch (e) {
      console.log('cert insert error:', e.message);
    }
  }
  return { ...cert, certified: cert.passed || existing.length > 0, newlyGranted };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  if (method === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // ── GET /version — deploy marker (no auth) ─────────────────────────────────
  if ((event.path || event.rawPath || '/').replace(/^\//, '').split('/')[0] === 'version') {
    return ok({ version: 'password-reset-2026-06-10', adminGuardHonorsEmails: true, cumulativeCert: true, passwordReset: true });
  }

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

    // ── POST /auth/forgot — self-service password reset request ──────────────────
    // Always returns 200 (never reveals whether an email is registered). When the
    // email maps to a user, mints a token and emails the reset link.
    if (method === 'POST' && seg[0] === 'auth' && seg[1] === 'forgot') {
      const { email } = body;
      if (email && typeof email === 'string') {
        const norm = email.toLowerCase().trim();
        const [rows] = await conn.query('SELECT id, email, full_name FROM users WHERE email = ?', [norm]);
        if (rows.length) {
          const raw = await createResetToken(conn, rows[0].id, RESET_TTL_SELF);
          await sendResetEmail(rows[0].email, rows[0].full_name, `${APP_BASE_URL}/reset?token=${raw}`, 'self');
        }
      }
      return ok({ ok: true });
    }

    // ── POST /auth/reset — consume a token and set a new password ────────────────
    if (method === 'POST' && seg[0] === 'auth' && seg[1] === 'reset') {
      const { token: resetToken, password } = body;
      if (!resetToken || !password) return fail('Token y contraseña requeridos');
      if (password.length < 6) return fail('La contraseña debe tener al menos 6 caracteres');
      const [rows] = await conn.query(
        `SELECT id, user_id FROM password_resets
          WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
          ORDER BY created_at DESC LIMIT 1`,
        [sha256(resetToken)]
      );
      if (!rows.length) return fail('El enlace de restablecimiento es inválido o ha expirado', 400);
      const hash = await hashPwd(password);
      await conn.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].user_id]);
      // Consume this token and invalidate any other outstanding tokens for the user.
      await conn.query('UPDATE password_resets SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL', [rows[0].user_id]);
      return ok({ ok: true });
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
      // Per-section score (display only) — uses THIS section's question count, not 55.
      const { correct, pct, errs, passed, reasons } = calcScore(answers, total_questions, passing_threshold);
      await conn.query('UPDATE quiz_attempts SET status=?, total_correct=?, total_questions=?, section_errors=?, score_percent=?, completed_at=NOW() WHERE id=?', [passed ? 'passed' : 'failed', correct, total_questions, JSON.stringify(errs), pct, seg[1]]);
      // Certification is decided CUMULATIVELY across all the user's completed attempts
      // (not by this single section). Auto-grant here so a perfect run earns the tier.
      const [[att]] = await conn.query('SELECT user_id, certification_tier FROM quiz_attempts WHERE id = ?', [seg[1]]);
      let cert = null;
      if (att) { try { cert = await syncCertification(conn, att.user_id, att.certification_tier); } catch (e) { console.log('cert sync error:', e.message); } }
      return ok({ total_correct: correct, total_questions, score_percent: pct, section_errors: errs, passed, fail_reasons: reasons, cert });
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

    // ── GET /users/:id/cert-status ─────────────────────────────────────────────
    // Authoritative cumulative certification status for a tier (correct vs 55,
    // per-section errors, pass/fail reasons, and whether the cert row exists).
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'cert-status') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [existing] = await conn.query('SELECT id FROM certifications WHERE user_id=? AND certification_tier=?', [seg[1], tier]);
      const cert = await certEligibility(conn, seg[1], tier);
      return ok({ ...cert, certified: cert.passed || existing.length > 0 });
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

    // ── GET /users/:id/wrong-answers ──────────────────────────────────────────
    if (method === 'GET' && seg[0] === 'users' && seg[2] === 'wrong-answers') {
      const tier = (q.tier || 'junior').toLowerCase();
      const [rows] = await conn.query(
        `SELECT a.question_id AS questionId, a.section, a.user_answer AS userAnswer, a.ai_reasoning AS aiReasoning
         FROM answers a
         JOIN quiz_attempts qa ON qa.id = a.attempt_id
         WHERE qa.user_id = ? AND qa.certification_tier = ?
           AND qa.status IN ('passed', 'failed')
           AND COALESCE(a.final_grade, a.ai_grade) = 0
         ORDER BY a.section, a.question_id`,
        [seg[1], tier]
      );
      return ok(rows);
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
          COALESCE((
            SELECT COUNT(DISTINCT a.question_id)
            FROM answers a
            JOIN quiz_attempts qa ON qa.id = a.attempt_id
            WHERE qa.user_id = u.id AND qa.certification_tier = 'junior'
              AND qa.status IN ('passed','failed')
              AND COALESCE(a.final_grade, a.ai_grade) = 1
          ), 0) as correct,
          55 as total,
          MAX(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) as certified,
          MAX(c.certification_tier) as certification_tier
         FROM users u
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
      const [adminCheck] = await conn.query('SELECT is_admin, email FROM users WHERE id = ?', [claims.sub]);
      const row = adminCheck[0];
      const isAdmin = !!row && (row.is_admin || ADMIN_EMAILS.has(row.email));
      if (!isAdmin) return fail('Forbidden', 403);
      // Self-heal: persist admin flag for hardcoded admins so the DB matches ADMIN_EMAILS.
      if (row && !row.is_admin && ADMIN_EMAILS.has(row.email)) {
        await conn.query('UPDATE users SET is_admin = 1 WHERE id = ?', [claims.sub]);
      }

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

      // DELETE /admin/users/:id — hard-delete a user (cascades to attempts/answers/certs)
      if (method === 'DELETE' && seg[1] === 'users' && seg[2] && !seg[3]) {
        if (seg[2] === claims.sub) return fail('No puedes eliminar tu propia cuenta', 400);
        const [r] = await conn.query('DELETE FROM users WHERE id = ?', [seg[2]]);
        return ok({ ok: true, deleted: r.affectedRows });
      }

      // POST /admin/users/:id/send-reset — email a password-reset link to the user
      if (method === 'POST' && seg[1] === 'users' && seg[3] === 'send-reset') {
        const [urows] = await conn.query('SELECT id, email, full_name FROM users WHERE id = ?', [seg[2]]);
        if (!urows.length) return fail('Usuario no encontrado', 404);
        const raw = await createResetToken(conn, urows[0].id, RESET_TTL_INVITE);
        const sent = await sendResetEmail(urows[0].email, urows[0].full_name, `${APP_BASE_URL}/reset?token=${raw}`, 'invite');
        if (!sent) return fail('No se pudo enviar el correo. Verifica la configuración de Resend (RESEND_API_KEY / dominio).', 502);
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
        const [[attRow]] = await conn.query('SELECT user_id, certification_tier, total_questions FROM quiz_attempts WHERE id=?', [attemptId]);
        // Score this section against ITS OWN question count, never the 55-question tier
        // total — otherwise a perfect single section reads ~51% and flips to "failed".
        const sectionTotal = (attRow && attRow.total_questions) ? attRow.total_questions : answers.length;
        const threshold = config?.passing_threshold ?? 0.9;
        const { correct, pct, errs, passed, reasons } = calcScore(answers, sectionTotal, threshold);
        await conn.query('UPDATE quiz_attempts SET status=?, total_correct=?, total_questions=?, section_errors=?, score_percent=? WHERE id=?', [passed ? 'passed' : 'failed', correct, sectionTotal, JSON.stringify(errs), pct, attemptId]);
        // Re-evaluate cumulative certification after the override (grant-only).
        let cert = null;
        if (attRow) { try { cert = await syncCertification(conn, attRow.user_id, attRow.certification_tier); } catch (e) { console.log('cert sync error:', e.message); } }
        return ok({ total_correct: correct, total_questions: sectionTotal, score_percent: pct, section_errors: errs, passed, fail_reasons: reasons, cert });
      }
    }

    return fail('Not found', 404);
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ message: 'Internal server error', detail: e.message }) };
  }
};
