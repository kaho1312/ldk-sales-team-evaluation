# LDK Sales Team Evaluation — Project Memory

# Last updated: 2026-07-28 (session 6, long day — ALL SHIPPED & LIVE, full detail in §11 sessions
6c–6g). Reconciled memory with the Mid-Level tier (live since ~2026-07-14). Shipped the Senior
Google-Sheet question loader, then fixed a threshold-clobber bug, a CSV-export gid=0 bug, and a
sheet-parser gap (an answer row missing the "Respuesta:" label silently dropped 2 questions when the
user hand-edited the sheet to 61 questions). Swapped the grader's LLM provider Anthropic → DeepSeek
(the old key started rejecting 100% of calls) and closed the long-standing P1: a grading-SERVICE
failure no longer gets saved as a wrong answer (caught a real leak bug via 2-lens adversarial review).
Rebuilt `GET /leaderboard` twice per user feedback — first to stop showing a Junior-scoped score next
to a higher earned tier's badge, then again to show cumulative correct/total across the WHOLE
curriculum (Junior+Mid-Level+Senior = 176) instead of just the best tier — and color-coded the
leaderboard's tier badges (teal/blue/amber) to match the rest of the app. Commits: `9133f8f` `ec34607`
`532ed92` `fc87661` `5b2a9bb` `516c768` `9589868` `f5b5c7f`. Two Lambda uploads done by the user
(grader DEEPSEEK_API_KEY + code; api leaderboard code, twice) — all confirmed live.)

> Persistent project memory. Built from CLAUDE.md, progress.md, migrations, lambda code, and src. Keep this current at the end of every session (see SESSION END CHECKLIST).

---

## 1. WHAT THIS PROJECT IS

A certification quiz web app for the LDK DMC sales team (a Mexican inbound-tourism company). Sales agents log in with their `@ldk.lat` email and answer **open-ended** questions about products, daily operations, and platforms. Each answer is graded by Claude (Haiku) using lenient, interpretive criteria rather than exact-match. Agents earn tier certifications — **Junior** (55 q, A/B/C) and **Mid-Level** (60 q, A–F) are LIVE with hardcoded questions; **Senior** (60 q, 6 sections) is LIVE too but loads its questions from a Google Sheet at runtime (see §6b). The app is fully AWS-hosted (Amplify + Lambda + RDS MySQL) and uses custom JWT auth — no Cognito, no Supabase.

---

## 2. STACK

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 18 + Vite 5 + TypeScript | dark theme |
| UI | Tailwind CSS + shadcn/ui (Radix primitives) | `src/components/ui/` |
| Routing | react-router-dom 6 | |
| Data fetching | @tanstack/react-query | present in deps; most calls go through `src/lib/api.ts` |
| Auth | Custom JWT (HS256) signed in Lambda | NOT Cognito |
| Backend API | AWS Lambda `ldk-quiz-api` (`lambda/index.mjs`), Node 22, `mysql2/promise` | Function URL |
| Grader | AWS Lambda `ldk-quiz-grader` (`lambda/grader-deploy.mjs`), Node 22 | calls Anthropic API via `fetch` |
| Database | AWS RDS MySQL 8 | live, schema in `migrations/` |
| Hosting / CI | AWS Amplify (auto-deploy from `main`) | domain quiz.ldk.fyi |
| Tests | Vitest (unit) + Playwright (e2e) | `src/test/`, `verify_quiz.mjs` (untracked) |
| **DEAD / LEGACY** | `@supabase/supabase-js` dep, `src/lib/supabase.ts`, `supabase/` dir | project migrated off Supabase — **do not use** |
| **DEAD / LEGACY** | `@anthropic-ai/sdk` dep in `package.json` | grader uses raw `fetch`, not the SDK (SDK layer broke on Node 22) |
| **DEAD / LEGACY** | Root-level `.tsx` drafts (`Index.tsx`, `Leaderboard.tsx`, …) and `react-quiz/` | old drafts, untracked clutter — **never edit** |

---

## 3. KEY FILES

Active files that matter for future changes (excludes `ui/` primitives, `supabase/`, root drafts):

| File | Responsibility |
|---|---|
| `src/pages/Index.tsx` | Main quiz flow — start/section/quiz/results/leaderboard screens, break/resume, attempt lifecycle, certification grant |
| `src/pages/Login.tsx` / `Register.tsx` | Auth pages (`@ldk.lat` only) |
| `src/pages/Admin.tsx` / `AdminAttempt.tsx` | Admin dashboard (in progress — see NEXT PRIORITIES) |
| `src/pages/NotFound.tsx` | 404 |
| `src/lib/api.ts` | ALL backend calls to `ldk-quiz-api` (attempts, answers, progress, certs, leaderboard, admin) |
| `src/lib/auth.ts` | JWT login/register/logout; token + user in localStorage |
| `src/lib/questions.ts` | Hardcoded question bank in `FALLBACK_QUESTIONS` (55 Junior + 60 Mid-Level) + per-tier `TIER_SECTIONS`/`TIER_SECTION_META` (section source of truth) + CSV/Google-Sheet parsers |
| `src/lib/scoring.ts` | Frontend pass/fail logic (`calculateScore`, `ScoreResult`) |
| `src/lib/progress.ts` | localStorage progress cache (fast path before backend loads) |
| `src/lib/i18n.ts` | ES/EN strings (`LANG`) |
| `src/context/AuthContext.tsx` | Auth session provider (`useAuth`) |
| `lambda/index.mjs` | `ldk-quiz-api` — auth, JWT, all RDS routes, admin routes, `calcScore` |
| `lambda/grader-deploy.mjs` | `ldk-quiz-grader` — Anthropic grading call + JSON parsing |
| `migrations/001_mysql_schema.sql` | RDS MySQL 8 schema (users, quiz_configs, quiz_attempts, answers, certifications) |
| `migrations/002_add_password.sql` | Adds `password_hash` for custom JWT auth |
| `migrations/003_password_resets.sql` | `password_resets` table (single-use, hashed reset tokens) — applied |
| `migrations/004_midlevel_sections.sql` | Relaxes `answers.section` CHECK to A–F + activates the Mid-Level `quiz_config` (60 q, 6 sec) — applied |

---

## 4. INFRASTRUCTURE ENDPOINTS

| Thing | Value |
|---|---|
| API Lambda URL | `https://wsi4xjvsewtoshfwqc2m2e24t40yvczk.lambda-url.us-east-1.on.aws/` |
| Grader Lambda URL | `https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/` |
| API Lambda name | `ldk-quiz-api` |
| Grader Lambda name | `ldk-quiz-grader` |
| Lambda runtime | Node.js 22.x |
| Custom domain | `quiz.ldk.fyi` |
| Amplify | auto-deploys from `main` branch |
| RDS | MySQL 8 — `ldk-quiz.c65k62iq67vh.us-east-1.rds.amazonaws.com`, port `3306`, user `LDKadmin`. Connection comes from Lambda env (`DB_HOST` etc.) |
| GitHub | `kaho1312/ldk-sales-team-evaluation` (branch `main`) |
| Region | `us-east-1` |

**Environment variables:**

| Var | Where set | Purpose |
|---|---|---|
| `VITE_API_URL` | Frontend build (.env / Amplify env) | base URL → `ldk-quiz-api` |
| `VITE_GRADER_URL` | Frontend build | grader Lambda URL |
| `VITE_GRADER_KEY` | Frontend build (optional) | sent as `x-api-key` if present |
| `JWT_SECRET` | `ldk-quiz-api` Lambda env | HS256 signing key (defaults to insecure literal if unset — **set in prod**) |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `ldk-quiz-api` Lambda env | RDS connection (`DB_NAME` defaults `ldk_quiz`; user `LDKadmin`). RDS is reachable from the dev machine (TCP 3306 open) — one-off `mysql2` scripts can run migrations. |
| `DEEPSEEK_API_KEY` | `ldk-quiz-grader` Lambda env | **LIVE since 2026-07-28 (session 6c).** DeepSeek API auth — replaced `ANTHROPIC_API_KEY` when the grader's LLM provider was switched (Anthropic key started rejecting 100% of calls). See §11. |
| `RESEND_API_KEY` | `ldk-quiz-api` Lambda env | **Set (session 4).** Resend API key for password-reset emails (raw `fetch` to `api.resend.com`). Required for reset emails to send. |
| `RESET_FROM` | `ldk-quiz-api` Lambda env (optional) | Reset email sender. Defaults to `LDK Ventas <no-reply@ldk.fyi>` (Resend-verified domain = **ldk.fyi**). |
| `APP_BASE_URL` | `ldk-quiz-api` Lambda env (optional) | Base URL for reset links. Defaults to `https://quiz.ldk.fyi`. |

**New routes (session 4, `ldk-quiz-api`):** `POST /auth/forgot` (public), `POST /auth/reset` (public), `POST /admin/users/:id/send-reset` (admin), `DELETE /admin/users/:id` (now wired into Admin UI). `/version` = `midlevel-2026-07-14` (current live value, verified live 2026-07-27; was `password-reset-2026-06-10` at session 4). New table `password_resets` (migration `003_password_resets.sql`, applied).

**New route (session 6, 2026-07-27, `ldk-quiz-api`):** `GET /quiz-configs/questions?tier=` — server-side
proxy that fetches a tier's `questions_source_url` Google Sheet as CSV (see §6b). Also: admin
`PUT /quiz-configs/:id` now receives `passing_threshold` from the UI (was being clobbered to 0). `/version`
= `sheet-questions-2026-07-27b`. ✅ **Live & verified 2026-07-27** — proxy returns the sheet's 60 Senior questions (6 SECCIÓN headers, 60 Respuesta rows). (Since superseded — Senior now has 61 questions; see §11 session 6f.)

**Changed route (session 6g, 2026-07-28, `ldk-quiz-api`):** `GET /leaderboard` now returns cumulative
correct/total across the WHOLE curriculum (Junior+Mid-Level+Senior = 176), not scoped to any single
tier — see §11 session 6g (supersedes an intermediate tier-scoped version from session 6e, same day).
`/version` = `leaderboard-grandtotal-2026-07-28`. ✅ Live & confirmed via user screenshot.

---

## 5. ARCHITECTURE FLOW

```
┌─────────┐   POST /auth/login        ┌──────────────┐   SELECT/UPDATE   ┌──────────┐
│ Browser │ ───(email,password)─────▶ │ ldk-quiz-api │ ────────────────▶ │ RDS MySQL│
│ (React) │ ◀──{token,user}───────────│  (Lambda)    │ ◀──────────────── │          │
└─────────┘   JWT+user → localStorage └──────────────┘                   └──────────┘
     │
     │ 1. Home mounts → GET /me, /users/:id/progress, /completed-sections,
     │    /section-progress, /active-attempts, /quiz-configs/active
     │
     │ 2. Pick Section A/B/C → POST /attempts (creates in_progress attempt)
     │      (if an in-progress attempt exists for that section → RESUME at answeredCount)
     │
     │ 3. For each question:
     │      ┌─ POST grader Lambda {question, answer, modelAnswer, section}
     │      │     grader → Anthropic (Haiku) → {passed, feedback, correct_answer}
     │      └─ POST /attempts/:id/answers {questionId, section, userAnswer, aiGrade, aiReasoning}
     │            (UPSERT on (attempt_id, question_id))
     │
     │ 4. Last question → POST /attempts/:id/complete {total_questions, passing_threshold}
     │      backend calcScore → sets status passed/failed, total_correct, section_errors, score_percent
     │
     │ 5. If all 3 sections done AND passed AND not already certified:
     │      POST /users/:id/certifications  → results screen shows ★ JUNIOR badge
     └─ Results screen pulls cumulative progress + GET /users/:id/wrong-answers for review
```

Auth on every non-auth route: `Authorization: Bearer <jwt>`; Lambda `verifyToken` checks HMAC + expiry. Admin routes additionally check `is_admin` on the user row.

---

## 6. QUESTION BANK

| Tier | DB config (`quiz_configs`) | Questions written? | Sections |
|---|---|---|---|
| Junior | `total_questions=55`, `is_active=1`, `passing_threshold=0.9` | ✅ 55 hardcoded in `FALLBACK_QUESTIONS` | A:28 (JR-A-01…28), B:13 (JR-B-29…41), C:14 (JR-C-42…55) |
| Mid-Level | `total_questions=60`, `section_count=6`, `is_active=1`, `passing_threshold=0.9` (live, verified 2026-07-27) | ✅ 60 hardcoded in `FALLBACK_QUESTIONS` | A:8, B:14, C:10, D:8, E:10, F:10 (`ML-*` ids) |
| Senior | `total_questions=60`, `is_active=1`, `passing_threshold=0.9`, `questions_source_url`=Google Sheet (live, verified 2026-07-27) | ✅ 60, **loaded from a Google Sheet** (NOT hardcoded) | 6 sections A–F (from the sheet), 10 q each (`SR-*` ids) — see §6b |

**Question shape** (`QuizQuestion` in `src/lib/questions.ts`):
```ts
{ id, tier: "Junior"|"Mid-Level"|"Senior", section: "A"|"B"|"C"|"D"|"E"|"F"|"All",
  question, modelAnswer, tags?, notes? }
```
- Section labels are **per-tier** (same letter, different meaning) — single source of truth is
  `TIER_SECTIONS` + `TIER_SECTION_META` in `questions.ts`.
  - Junior: A = Operación diaria y producto · B = Herramientas del día a día (Acordeón) · C = Plataformas (CORAA, ODS).
  - Mid-Level: A = Value Engine aplicado · B = Producto (Master File) · C = Acordeón y respuestas · D = Canales · E = CORAA y operación · F = Pricing.
- **Pass rules differ by tier:** Junior = ≥90% AND ≤5 errors per section; Mid-Level = ≥90% overall only
  (per-section error caps are gated to Junior — `enforceSectionCaps = tier === 'junior'` in `certEligibility`).
- Questions are currently **hardcoded** and shipped in the frontend bundle. `parseQuestionsFromCSV()` and `fetchQuestionsFromSheet()` exist (CSV upload / published Google-Sheet CSV) but `Index.tsx` only uses `FALLBACK_QUESTIONS` today.
- `quiz_configs.questions_source_url` column exists for a future externalized question source (not wired into the quiz UI yet).

---

## 6b. GOOGLE-SHEET QUESTION LOADER (session 6, 2026-07-27)

A tier with a `questions_source_url` set on its active `quiz_config` loads its questions
from that Google Sheet at runtime (Senior uses this; Junior/Mid-Level stay hardcoded).
- **Backend:** `GET /quiz-configs/questions?tier=` (`lambda/index.mjs`) reads the tier's
  `questions_source_url`, normalizes any `/edit` share link to a CSV export URL
  (`toCsvExportUrl`), fetches it **server-side** (Node `fetch`, follows the redirect), and
  returns `{ csv, sourceUrl }`. **Server-side on purpose:** Google's export 307 redirect
  lacks CORS headers, so a browser fetch is unreliable — the Lambda proxy sidesteps it.
  Returns a 502 with a Spanish hint if the sheet returns HTML (not shared publicly).
- **Sheet access:** a normal "Anyone with the link (Viewer)" share is enough — anonymous
  CSV export works (verified). No "Publish to web" required.
- **Parser** (`src/lib/questions.ts` `parseSheetQuestions(csv, tier)`): handles TWO layouts —
  (1) strict template (`id,tier,section,question,model_answer` headers) and (2) the **natural
  LDK eval layout** the team actually uses: `SECCIÓN N: Título (n)` header rows → sequential
  sections A,B,C…; each question is a numbered row followed by a `Respuesta: …` row. Returns
  `{ questions, sections, sectionMeta (labels from the sheet), errors }`.
- **Frontend** (`Index.tsx`): a mount effect loads every active tier with a URL and merges the
  parsed questions into `allQuestions`. `getSectionsForTier`/`getSectionCounts` are tier-dynamic
  so a tier with no hardcoded sections (Senior) renders from its loaded questions; the tier
  selector unlocks once questions load. Per-tier load failure is swallowed (tier stays locked).
- **⚠️ Caveat — id stability:** `SR-*` ids are derived from section + row position, so
  **reordering / inserting rows in the sheet re-maps ids** and can desync already-stored answers
  for in-progress Senior takers. Fine for a fresh tier; be careful editing a sheet mid-cohort.

---

## 7. GRADING LOGIC

**Provider switched Anthropic → DeepSeek on 2026-07-28 (session 6c)** — the Anthropic API key/account
started rejecting 100% of calls; see §11 for the incident. Everything below reflects the CURRENT
(DeepSeek) implementation, verified live.

- **File:** `lambda/grader-deploy.mjs` (deployed as `ldk-quiz-grader`, renamed to `index.mjs` in the zip).
- **Provider/model:** DeepSeek, OpenAI-compatible Chat Completions API — `POST
  https://api.deepseek.com/chat/completions`, `Authorization: Bearer <DEEPSEEK_API_KEY>`, model
  `deepseek-chat`. (NOT Anthropic/Claude — that's a historical fact now, not the live grader.)
- **max_tokens:** 1024 (raised from the old 500, which risked truncating longer answers).
- **Retries:** up to 3 attempts with linear backoff (800ms × attempt) on HTTP 429/500/502/503/504/529 or
  a thrown fetch error.
- **response_format:** `{type:"json_object"}` — DeepSeek's structured-output mode, for reliable JSON.
- **Sent to the model:** the SAME Spanish system prompt as before (lenient/interpretive grading — approve
  on conceptual correctness even with different wording; fail only on factual errors, fundamental
  misunderstanding, or blank/irrelevant), plus a user message containing `section`, `question`,
  `modelAnswer` (reference), and the agent's `answer`.
- **Returned JSON (success):** `{"passed": bool, "feedback": "≤2 sentences in Spanish", "correct_answer":
  "text if failed, else null"}`. No `score` field.
- **Returned JSON (grader-service failure, session 6c/6d):** `{"passed": false, "feedback": "Error al
  procesar la evaluación.", "correct_answer": null, "error": true, "error_detail": "<technical reason>"}`
  — STILL returns HTTP 200 (so a plain `response.ok` check can't distinguish this from a real grade; the
  frontend must inspect `data.error`). `error`/`error_detail` are new fields the pre-6d frontend ignored;
  the 6d frontend checks `data.error` explicitly and does NOT treat this as an incorrect answer — see §11
  session 6d and §10b Layer 3 (now closed).
- **Parsing:** strip ```` ```json ```` fences, and if the text doesn't start with `{`, wrap it in braces,
  then `JSON.parse`.
- **Frontend handling** (`Index.tsx` `handleSubmitAnswer`): on a REAL grade, personalizes feedback ("el
  agente" → "tu respuesta"), caches to localStorage, and POSTs to `/attempts/:id/answers` (non-blocking).
  On a grading-SERVICE failure, persists nothing and shows a retry banner instead (§11 session 6d).
- **Lambda memory size / timeout:** UNKNOWN — verify in AWS console.
- **No S3 / no handbook.** The deployed `ldk-quiz-grader` is a simple grader only — it does NOT load any
  handbook or read from S3. Its only env var is `DEEPSEEK_API_KEY` (was `ANTHROPIC_API_KEY` before
  2026-07-28). (Older progress notes describing S3/handbook integration were plans that were never built.)

---

## 8. AUTH SYSTEM

- **Custom JWT, not Cognito.** Implemented in `lambda/index.mjs`:
  - `POST /auth/register` and `POST /auth/login` return `{token, user}`.
  - JWT is HS256 (`createHmac('sha256', JWT_SECRET)`), header.payload.signature base64url, 7-day TTL (`JWT_TTL`).
  - Passwords hashed with `scrypt` + 16-byte random salt, stored as `salt:hash` in `users.password_hash`; verified with `timingSafeEqual`.
- **Restriction:** email must end in `@ldk.lat` (enforced both frontend `isEmailValid` and backend register). Min password length 6.
- **Admin:** `ADMIN_EMAILS = {kay@ldk.lat, fernanda@ldk.lat, joaquin.g@ldk.lat}` get `is_admin=1` at registration; admin routes re-check `is_admin` in DB.
- **Token storage (client):** `localStorage` — `ldk_jwt` (token) and `ldk_user` (user JSON), keys in `src/lib/auth.ts`. Sent as `Authorization: Bearer <token>`.
- **Session provider:** `src/context/AuthContext.tsx` (`useAuth`); `getCurrentSession()` is deprecated legacy.

---

## 9. HARD RULES

| Rule | Why |
|---|---|
| Never edit root-level `.tsx` files (`Index.tsx`, `Leaderboard.tsx`, etc.) — edit only `src/` | Root files are dead drafts; editing them changes nothing live and causes confusion |
| Do NOT add Supabase dependencies or use `src/lib/supabase.ts` / `supabase/` | Project migrated to AWS-only; Supabase is legacy |
| Do NOT enable CORS in AWS Function URL settings | CORS is set in Lambda code only; enabling both produces duplicate `*, *` headers and breaks all requests |
| CORS headers stay in Lambda code | Single source of truth; see rule above |
| Do NOT use Cognito | Auth is custom JWT in `ldk-quiz-api` |
| In Amplify, use `npm install` — never `npm ci` | `npm ci` breaks the Amplify build for this project |
| Deploy Lambda only via zip → AWS Console (AWS CLI is NOT installed) | No CLI available on the dev machine |
| Always include `lambda/node_modules` in the zip | `mysql2` etc. must ship with the function |
| Set `JWT_SECRET` in prod Lambda env | Code falls back to a hardcoded insecure default if unset |

---

## 10. KNOWN ISSUES

| Issue | Status | Notes |
|---|---|---|
| "Error al conectar con el servidor de evaluación" on submit | Likely resolved — VERIFY | progress.md root-caused it to grader returning JSON without braces; the brace-wrap fix IS present in `lambda/grader-deploy.mjs`. Frontend catch behavior unverified end-to-end |
| Discarded attempts pollute cumulative counts | OPEN (backend) | `handleDiscardAndStart` calls `completeAttempt` on a partial attempt → marks it `failed`, so its partial answers persist and count in `getUserProgress`/`section-progress` forever (root cause of stray counts on the results screen). Proper fix = delete/abandon discarded attempts (Lambda route + redeploy). Frontend results display now tolerates this but still shows a small partial-section row |
| Senior tier | ✅ LIVE via Google Sheet, verified 2026-07-28 (session 6, §6b + §11 6f) | Senior config `is_active=1`, `total_questions=61`, `passing_threshold=0.9`, `questions_source_url`=Sheet (grew from 60→61 when the user hand-added a question; parser fixed same day to not require the "Respuesta:" label). Questions load at runtime via the proxy route, verified returning all 61 across 6 sections. |
| Admin panel incomplete | OPEN | see NEXT PRIORITIES |
| **Certification never grants even with a perfect score** | ✅ FIXED & DEPLOYED (P0, session 3) | See §10b + §11. Cumulative server-side auto-grant. Lambda live (`/version`=`cumulative-cert-2026-06-09`); frontend pushed `b4aede4`. Fernanda certified. |
| **Single section scored against the full 55-question tier** | ✅ FIXED & DEPLOYED (P0, session 3) | See §10b + §11. Override recalc + discard path now use the section's own question count. |
| **Grader marks correct answers wrong on any infra hiccup** | ✅ FIXED & DEPLOYED (P1, session 6, 2026-07-28) | See §10b Layer 3 (root cause) + §11 (fix). A grading-service failure now shows a retry banner and persists nothing, instead of being saved as wrong. |
| "TU PROGRESO" home cards: no correct/wrong; stale green on retake; **56/56** footer | OPEN (NEXT) | See §10c. Cards show only *answered*; retake keeps stale green "28/28"; footer shows >55 because `GET /progress` sums answer rows (non-DISTINCT). Design scoped; one open question (retake scoring model). |
| Results: "¡Certificada!" badge can show ALONGSIDE the amber "ya no es posible alcanzar el 90%" warning | OPEN (low; pre-existing, surfaced session 4) | `QuizResults` renders `certNotPossible` whenever `certOnTrack===false`, independent of the `certified` flag — so a certified user whose current cumulative is <90% (e.g. test@ldk.lat at 46/55) sees both. NOT caused by the session-4 review-UI work. Quick fix: gate the warning on `!certified`. |
| Password-reset email delivery | ✅ CONFIRMED WORKING END-TO-END (2026-06-10) | User received the reset email from `no-reply@ldk.fyi` and successfully changed their password via the `/reset?token=` link. Self-service forgot flow fully verified live. (Resend domain ldk.fyi verified.) |

---

## 10b. CERTIFICATION / SCORING ROOT CAUSE (2026-06-09, session 3)

**Symptom (reported by Fernanda, reproduced via admin panel):** she answered ALL 55 questions
correctly (Section A 28/28, B 13/13, C 14/14) yet every attempt reads "Reprobado" and she has
**no certification**. The admin panel shows the controversy plainly: `51% (28/28)`, `24% (13/13)`,
`25% (14/14)` — all correct, all "failed".

This is **three misaligned layers**, not one bug. The answer *data* is the only correct part.

**Layer 1 — single sections scored against the full 55-question tier.**
Each section is a *separate* `quiz_attempt`. `calcScore`/`calculateScore` compute `pct = correct /
totalQuestions`. When `totalQuestions = 55` is used for a single section, a perfect Section A is
28/55 = 51%, B = 13/55 = 24%, C = 14/55 = 25% — all below the 0.9 threshold, so every attempt is
"failed". **No single section can ever reach 50/55, so no individual attempt can ever pass.**
Bad denominators live in:
- `handleDiscardAndStart` → `completeAttempt(session.attemptId, quizConfig)` passes `quizConfig`
  (`total_questions:55`) — `src/pages/Index.tsx` (~L232).
- Admin override recalc uses `config.total_questions` (55) for the section `score_percent` AND does
  not update the `total_questions` column — `lambda/index.mjs` `POST /admin/answers/:id/override`
  (~L402-403). This exactly reproduces `51% (28/28)`: pct recomputed against 55, `(28/28)` column
  left at the original section size. **Kay's "Correcto" overrides on Fernanda's answers re-scored her
  perfect sections against 55 and flipped them to failed.**
- The normal-finish path (`handleNext` ~L373) already passes `sessionQuestions.length` (the section
  size) — so a *normally completed* section shows the right %; only discard/override corrupt it.

**Layer 2 — certification never aggregates across sections.**
The grant fires only on `result.passed && sectionsDone` where `result` is the *single last-completed
section attempt* (`src/pages/Index.tsx` ~L402, deployed/HEAD). Since no per-section attempt is ever
`passed` (Layer 1), `grantCertification` never runs. **There is no code path that evaluates
cumulative 50/55-across-all-three-sections server-side.** `getUserProgress` SUMs correct answers but
nothing turns that sum into a grant.

**Layer 3 — grader marks correct answers wrong on any infra hiccup.**
`lambda/grader-deploy.mjs` (~L79-82): any non-200, JSON parse failure, or timeout falls through to
`{passed:false, feedback:"Error al procesar la evaluación.", correct_answer:null}`, and the frontend
saves it as `final_grade=false`. Likely triggers: `max_tokens:500` truncating Claude's JSON
mid-string (content-dependent), 429 rate-limit under concurrency, or timeout. No retry, no
distinction between "wrong answer" and "grader broke". This is the intermittent "Error al procesar
la evaluación" seen on Fernanda's live Q17 and the most likely source of "errores I couldn't
reproduce". Live grader probe with a normal payload returned `passed:true` — so the failure is
**intermittent**, not total. (Confidence: mechanism confirmed + fallback path reproduced; NOT proven
to have fired on her specific saved answers without DB access to her `final_grade` values.)

**Key schema fact for the fix:** `answers.final_grade` is a GENERATED STORED column =
`COALESCE(admin_override, ai_grade)` (migration 001 ~L78). So `MAX(final_grade)` per `question_id`
across all of a user's `('passed','failed')` attempts = best-grade-wins, which naturally tolerates
the "discarded attempts pollute counts" issue (a worse/partial retake is dominated by a better one).

**The fix (P0, in progress this session):** evaluate certification *cumulatively server-side* from
the `answers` table (distinct best grade per question vs the tier config's `total_questions=55` /
`passing_threshold=0.9` and the ≤5-errors-per-section rule), auto-grant on completion and on admin
override, and stop scoring a single section against 55. Per-section `score_percent` becomes a
display-only value computed against that section's own question count; certification no longer
depends on any single attempt's pass/fail. Existing unit tests (Scenarios 1–2) only exercise the
**legacy localStorage** cert path, not the deployed backend path — they pass but give false
confidence; a backend cumulative-cert test is needed (P3).

---

## 10c. "TU PROGRESO" HOME-SCREEN IMPROVEMENT (scoped 2026-06-09, build NEXT SESSION)

**Where:** `src/pages/Index.tsx`, the "TU PROGRESO" block (~L623–708, `screen === "start"`).

**Problems to fix (3):**
1. Section A/B/C cards show only *answered* counts ("28/28 respondidas") — not how many were **correct vs
   wrong**.
2. **Stale green on retake.** A card's green "Completada / 28/28" persists during a retake because
   `completedSections` is never cleared when a new attempt starts, and `sectionProgress` =
   `COUNT(DISTINCT question_id)` across ALL attempts (so re-answering already-seen questions doesn't move
   it). Net: start a retake, answer 2 questions, return home → still green "28/28". Confusing.
3. **Footer "56/56"** (impossible; only 55 questions). `GET /users/:id/progress` sums answer *rows*
   (`SUM(final_grade) … COUNT(*)`, no DISTINCT) across `('passed','failed')` attempts, so retakes inflate
   both numerator and denominator past 55.

**Product decisions captured from the user (2026-06-09):**
- **Card display = correct / wrong / unanswered** (three-way), e.g. `✓14  ✗6 · 8 sin responder`, with a
  green(correct)/red(wrong)/grey(unanswered) progress bar.
- **Green ✓ "done" only within the cert limit** (≤ `floor(55*0.1)=5` wrong in that section); show an amber
  "keep improving / por corregir" state if the section exceeds the limit.
- **OPEN QUESTION — decide before building: retake scoring model.** keep-best (matches the shipped
  cumulative cert — a retake never lowers you) vs replace-with-latest vs wipe-&-restart. The three differ a
  lot in backend work and UX; do NOT implement until the user picks. (User deferred this on 2026-06-09.)

**Planned implementation (pending the open question):**
- **Reuse `GET /users/:id/cert-status`** — it already returns deduped `section_correct` / `section_errors`
  / `section_answered` + cumulative `correct` / `total_questions` (added in §11 P0 work). Make it the
  single source for the home cards AND the footer. This kills the 56/56 bug (distinct, ≤55) and gives the
  correct/wrong/unanswered numbers with NO new scoring code.
- **Retake visual fix:** give an active in-progress attempt precedence over the stale `completedSections`
  green state, and drive the in-progress card's bar/label from the active attempt's `answeredCount`
  (`getActiveAttempts`) so a 2-of-28 retake reads "Reintento · pregunta 3 de 28", not green 28/28. (May also
  clear the section from `completedSections` visually when a retake starts.)
- **56/56 fix:** prefer pointing the footer at `cert-status`; alternatively change `GET /progress` to
  `COUNT(DISTINCT question_id)` + best-grade-wins for consistency with `certEligibility`/leaderboard.
- i18n: this block uses mostly inline ES/EN ternaries (not `i18n.ts` keys) — add new strings the same way
  or migrate to `LANG`.

---

## 11. RECENTLY FIXED BUGS (do not reintroduce)

**Session 6f (2026-07-28) — sheet parser required the "Respuesta:" label; a hand-edit silently dropped a question — SHIPPED, DEPLOYED & VERIFIED LIVE.**
Symptom: user added an 11th question to the LIVE Senior sheet's Section 2 (and correctly updated the
admin "Total de preguntas" to 61), but the quiz kept loading only 60 — Section B still showed 10
questions, not 11. File: `src/lib/questions.ts` (`parseNaturalSheet`), test:
`src/test/sheetParser.test.ts`. Frontend-only.
- **Root cause:** the new question's answer row was typed as the raw answer text (e.g.
  `www.kay.tours, www.livingdreamsmexico.com, ...`) WITHOUT the `Respuesta:` prefix every other row in
  the sheet uses. The old parser's answer detection was PURELY regex-based
  (`/^respuesta\s*[:.\-–]?\s*(.*)/i`) with no fallback — a row missing that literal label was
  misclassified as a new, un-answered question, which in turn caused BOTH the new question AND the one
  before it to be silently dropped (the "new question" row overwrote the still-pending previous question
  without logging an error, since that overwrite path didn't check for a dangling `pendingQ`).
- **Fix:** the parser now uses the sheet's OWN reliable structural signal — a bare integer in column 0 —
  to detect "this row starts a new question" (this is literally the sheet's question-number column,
  which the team has consistently filled in on every row, including the malformed one). Any other content
  line, while a question is pending, is now treated as that question's answer; the `Respuesta:` label is
  stripped if present but no longer REQUIRED. Also fixed two smaller gaps found while rewriting: a
  dangling pending question at the very end of the sheet was previously dropped with no error logged (now
  caught); an unrecognized row while INSIDE a section is now surfaced as an error (content BEFORE the
  first `SECCIÓN` header — e.g. a title row — is still silently ignored, matching prior behavior).
- **Verified:** `tsc` + 41 vitest (2 new regression tests — an unlabeled answer row parses correctly; a
  trailing question with no answer is still caught with an error). Playwright against the REAL, live,
  unmocked Senior sheet (not a fixture): before the fix, 6 sections all showed "10 pregs." (61 silently
  truncated to 60, config's `total_questions=61` visibly ahead of what actually loaded); after, 5 sections
  show 10 and Section B shows 11, and entering it reads "Pregunta 1 de 11" (3/3 checks). Commit `516c768`,
  pushed → Amplify (frontend-only, no Lambda/DB change).
- **Takeaway for future sheet edits:** the `Respuesta:` label is now optional/best-effort, not required —
  but keep numbering every question in column 0 (the team already does this consistently); that numbered
  column is what the parser actually depends on now.

**Session 6h (2026-07-28) — leaderboard certification badges color-coded by tier — SHIPPED & LIVE.**
User feedback on the (now grand-total) leaderboard: "can we distinguish the certification badges
better?" Root cause: `src/components/Leaderboard.tsx`'s badge was styled purely on `entry.certified`
(green "success" style for ANY certified tier, gray otherwise) — Junior/Mid-Level/Senior badges were
visually IDENTICAL, differing only in text. Frontend-only.
- **Fix:** added `tierBadgeStyles()`, reusing the SAME tier→color convention already used by
  `TierBadge` in `Admin.tsx`/`Index.tsx` (Junior=teal, Mid-Level=blue, Senior=amber) so a badge means
  the same thing everywhere in the app, rather than inventing a new palette. Uncertified stays neutral
  gray "En Progreso".
- **Verified:** `tsc` + 41 vitest + build clean. Playwright screenshot + `getComputedStyle` check on the
  live-rendered badges confirmed 3 genuinely distinct colors, consistently applied per tier (both SENIOR
  rows matched, both JUNIOR rows matched). Commit `f5b5c7f`, frontend-only, live via Amplify.

**Session 6g (2026-07-28) — leaderboard rewritten AGAIN: cumulative correct/total across the WHOLE curriculum — SHIPPED & LIVE.**
Follow-up to session 6e below, per direct user feedback after seeing the tier-scoped version live: "I
was hoping to see the correct / of all questions answered (amount of questions in junior + mid +
senior)" — i.e. overall mastery of the FULL question bank, not just the score for a user's single
best/certified tier. File: `lambda/index.mjs` `GET /leaderboard`. Backend-only.
- **Change:** `correct` = SUM of a user's distinct-correct-question count across EVERY tier they've
  attempted (not just their highest-held one — e.g. Fernanda's Junior score + her Senior score, added
  together). `total` = SUM of `total_questions` across ALL `quiz_configs` rows — **176** currently
  (55+60+61) — the SAME constant for every row, representing the full curriculum. The tier BADGE is
  unchanged (still the user's highest held certification). Sorting simplified back to raw `correct DESC`
  (name ASC tiebreak) since `total` no longer varies per row, so percentage-based sorting became
  unnecessary.
- **Verified live** (before shipping the badge-color change in 6h): user screenshot showed Fernanda
  174/176 ★Senior, Kay 165/176 ★Senior, Irlanda 156/176 ★Mid-Level, Test User 106/176 ★Junior, Ana
  53/176 ★Junior — sane, monotonically-plausible cumulative scores. Confirms the earlier
  data-integrity worry from session 6e (whether higher-tier certs were backed by real attempted
  questions) resolved itself: real non-zero contributions from each tier are visible in these sums.
- **Deploy:** committed `9589868`, `/version` → `leaderboard-grandtotal-2026-07-28`. User uploaded
  `lambda.zip` to ldk-quiz-api; confirmed live via the screenshot above.

**Session 6e (2026-07-28) — leaderboard showed a Junior-scoped score next to a higher-tier badge — SHIPPED & DEPLOYED, then SUPERSEDED by session 6g above (same day).**
Symptom (user screenshot): Fernanda Salas showed "55/55 ★ SENIOR", Kay Honig "52/55 ★ SENIOR", Irlanda
Campos "51/55 ★ MID-LEVEL" — all three had genuinely EARNED those higher tiers (confirmed: not a bogus
grant — see below), but the numeric score next to each badge was silently their JUNIOR score, not a score
against the tier actually shown. Root cause was invisible until Mid-Level (live since 2026-07-14) and
Senior (shipped this session) gave real users tiers above Junior to hold simultaneously. File:
`lambda/index.mjs` `GET /leaderboard`. Backend-only.
- **Root cause:** the query hardcoded `WHERE qa.certification_tier = 'junior'` for the `correct` count
  and `55 as total`, while the badge itself was `MAX(c.certification_tier)` — the user's HIGHEST held
  cert (this MAX() logic is correct/kept: `'junior' < 'mid-level' < 'senior'` alphabetically happens to
  match tier rank). The two halves of each row were computed against DIFFERENT tiers whenever a user held
  more than one cert. For a Senior-badge row, "55/55" isn't even a valid fraction for that tier (Senior
  has 61 questions) — it's a coincidental reuse of the Junior score.
- **Fix:** rewrote the route to fetch each user's best-held tier (unchanged), a per-`(user, tier)` correct
  count across ALL tiers in one query, and each tier's LIVE `total_questions` from `quiz_configs` — then
  pairs `correct`/`total` to match whichever tier is displayed. Falls back to `junior`/55 for an
  uncertified user (unchanged common case — e.g. Ana María Narváez, Carlos Ruiz). Sorting changed from
  raw `correct DESC` to score-**percentage** DESC (rows now carry different totals, so raw count no
  longer ranks fairly across tiers); `correct DESC` then `full_name ASC` remain as tiebreaks.
- **Deploy:** committed `5b2a9bb`, `/version` → `leaderboard-tierscoped-2026-07-28`. Uploaded & confirmed
  live (user screenshot: Fernanda 59/61 ★Senior, Kay 55/61 ★Senior, Irlanda 56/60 ★Mid-Level — proving
  their higher-tier certs WERE backed by real attempted questions, not a bogus grant). Superseded same
  day by session 6g's grand-total rewrite — this tier-scoped behavior is no longer live, kept here for
  history only.

**Session 6c (2026-07-28) — grader LLM provider swap (Anthropic → DeepSeek) — SHIPPED, DEPLOYED & VERIFIED LIVE.**
Symptom: the grader started returning `{passed:false,"Error al procesar la evaluación."}` on 100% of
calls, fast (~0.3s) — diagnostic of an account/key-level rejection, not our code (confirmed: not the
Senior/Sheet work, which is a different Lambda; not a timeout/overload, which would be slow; not
content-specific, since even a trivial probe failed). Root cause turned out to be the Anthropic API key/
account. **Fix: switched `ldk-quiz-grader` off Anthropic entirely, onto DeepSeek's OpenAI-compatible Chat
Completions API** (`lambda/grader-deploy.mjs`, deployed as `index.mjs`). Endpoint
`https://api.deepseek.com/chat/completions`, `Authorization: Bearer <DEEPSEEK_API_KEY>` (new env var,
replaces `ANTHROPIC_API_KEY`), model `deepseek-chat`. **Contract unchanged** — still
`{question,answer,modelAnswer,section}` in, `{passed,feedback,correct_answer}` out — so ZERO frontend/DB
changes were needed for the swap itself. While rewriting: `max_tokens` 500→1024 (was a truncation risk),
up to 3 attempts with backoff on 429/5xx, `response_format:{type:"json_object"}` for reliable JSON, and
on failure the response now ALSO carries `{error:true, error_detail:"..."}` (extra fields the frontend
ignores unless it's specifically checking, see session 6d below) so the real cause is inspectable without
CloudWatch. Commit `532ed92`. **Verified live** post-deploy: 4/4 grading probes correct (semantic-match
pass, wrong-answer fail w/ `correct_answer` filled in, blank-answer fail, real Senior question pass);
OPTIONS/CORS preflight intact. User uploaded `grader.zip` (built via a temp-dir copy renamed to
`index.mjs`, per the existing grader deploy convention — no `node_modules`) + set `DEEPSEEK_API_KEY` on
**`ldk-quiz-grader`** (the `b5sk5…` URL — not `ldk-quiz-api`).

**Session 6d (2026-07-28) — grading-service failures no longer saved as wrong answers — SHIPPED, DEPLOYED & VERIFIED LIVE. Closes §10b Layer 3 / old P1.**
This is the fix hinted at when DeepSeek's `{error:true}` field was added (6c): previously, ANY grader
failure — network error, non-2xx, OR (now) a 200 response with `data.error` truthy — was recorded as an
**incorrect answer**: saved to the backend (`saveAnswerToAttempt`), the localStorage cache (`saveAnswer`),
and `sessionResults`. A grader outage could silently fail real users out of certification with wrong
grades they never actually got. Files: `src/pages/Index.tsx`, `src/components/QuizQuestion.tsx`,
`src/lib/i18n.ts`. Frontend-only; no backend/DB change (the grader's contract addition — extra `error`/
`error_detail` fields — is additive, ignored by anything not looking for it).
- **Fix:** `handleSubmitAnswer` now treats a grading-service failure (fetch throw, non-2xx, `data.error`
  truthy, or a non-boolean `data.passed` — defensive against any malformed response) as a THIRD state,
  distinct from correct/incorrect. `graded` is deliberately left `false` — so the "Siguiente Pregunta"/
  Next button (gated on `graded`) never appears and the agent literally cannot advance past an ungraded
  question — and **nothing is persisted anywhere**. A new `gradingError: string | null` state (cleared at
  the top of every submit attempt) drives an amber "no pudimos evaluar tu respuesta, intenta de nuevo"
  banner in `QuizQuestion.tsx`, rendered only when `!graded && gradingError`. The agent's typed answer
  stays in the (unmounted-only-on-question-change) textarea, so retry = just clicking submit again.
- **Adversarial review caught a real bug my own first test missed:** two independent lenses (score-
  integrity + UX/state), each independently verified, found the SAME gap — `resetGrading()` (the function
  every abandon path calls: `handleBreak`, `handleResumeSection`, `handleSectionStart`,
  `handleDiscardAndStart`, `handleRestart`) reset `grading`/`graded`/`isCorrect`/`feedback`/
  `correctAnswer` but **not** the new `gradingError`. So a user who hit a grading failure and then took a
  break / switched sections / restarted (instead of immediately retrying) would see the stale error banner
  incorrectly leak onto the NEXT, never-submitted question. **Fixed by adding `gradingError` to
  `resetGrading()`'s reset list** — the single place all 5 call sites already route through. My own
  Playwright pass had only exercised "fail then immediately retry," never "fail then abandon" — the
  review process is what caught this, not manual testing. Lesson: for stateful multi-path UI flows, test
  the abandon/resume paths, not just the happy retry path.
- **Verified:** `tsc` + 39 vitest clean. Playwright (mocking the grader route with the real
  `b5sk5…` hostname glob, and stubbing `/attempts/*/answers` to count calls without touching real data):
  8/8 checks — an explicit `{error:true}` response AND a real network abort both show the banner and save
  **zero** answers; a subsequent successful retry saves **exactly one** answer, calls the grader **exactly
  3** times total (2 failed + 1 success, no missed/duplicate calls), and shows "Siguiente Pregunta". A
  dedicated regression test for the exact leaked-banner scenario the reviewers found (fail → "Tomar un
  descanso" → re-enter the section) confirms the fresh, unattempted question shows NO stale banner and an
  empty textarea. Commit `fc87661`.

**Session 6b (2026-07-27) — Google-Sheet question loader + Senior tier — SHIPPED, DEPLOYED & VERIFIED LIVE.**
Symptom: admin set Senior's `questions_source_url` + activated it, but "nothing happened" — the quiz
showed no Senior questions. Root cause: the admin URL field was **decorative** — the quiz only ever read
hardcoded `FALLBACK_QUESTIONS` (`Index.tsx` had `const [allQuestions] = useState(FALLBACK_QUESTIONS)`, no
setter; `fetchQuestionsFromSheet` existed but had ZERO callers), and Senior had no hardcoded questions.
Built the real loader — see **§6b** for the full mechanism (Lambda proxy route, `parseSheetQuestions`
natural+template parser, tier-dynamic sections, mount-effect merge). Files: `lambda/index.mjs`,
`src/lib/questions.ts`, `src/lib/api.ts`, `src/pages/Index.tsx`, `src/test/sheetParser.test.ts`.
- **Also fixed: admin config threshold-clobber bug (`src/pages/Admin.tsx`).** The Configuración form
  omitted `passing_threshold` on save, but the Lambda `PUT /quiz-configs/:id` overwrites ALL columns —
  so every save wiped the tier's threshold to 0 ("everyone passes"). This is what left Senior at 0%. The
  form now has an editable pass-% field and ALWAYS sends it (clamped 1–100%). Senior threshold repaired to
  0.9 live via the PUT route.
- **Verified:** `tsc` + 39 vitest (10 new parser tests) + `vite build` clean; Playwright vs the REAL sheet
  (route mocked with the real CSV since the Lambda wasn't deployed yet) — Senior unlocks, 6 sections render
  with sheet labels, 10 q each, section starts with the real first question (6/6). DB accepts `senior`
  attempts (tier CHECK ok, migration 001). `/version` → `sheet-questions-2026-07-27b`.
- **Deploy status:** ✅ DONE. Frontend pushed (`9133f8f`) → Amplify; Lambda uploaded to ldk-quiz-api
  (`/version`=`sheet-questions-2026-07-27b`). **Live-proxy gotcha found & fixed post-deploy (`ec34607`):**
  `toCsvExportUrl` appended `&gid=0`, which 400s when the sheet's first tab isn't gid 0 — now it only
  pins a gid when the source URL names one (else Google exports the first sheet). Verified live: proxy
  returns the 60 Senior questions. NOTE: mocked-route Playwright can't catch a bad export URL — always
  hit the live proxy after a Lambda deploy of a fetch-external route.
- **⚠️ id stability caveat (§6b):** `SR-*` ids derive from sheet row order — reordering rows re-maps ids and
  can desync stored answers mid-cohort.

**Session 6 (2026-07-27) — expired-session handling — SHIPPED & DEPLOYED (frontend-only).**
Reported symptom: the admin panel (`/admin`) showed "Error al cargar usuarios" + "No hay usuarios
registrados" and empty pages — user feared the certified users' data was lost. **No data was lost.**
Live `/leaderboard` confirmed all 5 users + certs intact (Fernanda 55/55 ★Junior, Kay 52/55
★Mid-Level, Irlanda 51/55 ★Junior, Test 46/55 ★Junior, Ana 27/55). Root cause: JWT is a 7-day TTL;
the browser's token had expired, but `AuthContext.fetchMe` returned `null` for BOTH a 401 (token
rejected) and a network outage, so `loadUser` kept the cached admin user ("keep cached user if server
unreachable"). The app stayed "logged in" with a dead token, sailed past `RequireAuth`/`RequireAdmin`
(which only check the cached `user`, never token validity), and every authed call 401'd →
"Error al cargar usuarios". Verified `/admin/users` itself was healthy: clean 403 for a non-admin
token, 401 for a bad/missing token — NOT a 500/schema issue.
- **Fix (`src/context/AuthContext.tsx`):** `fetchMe` now returns a discriminated `MeResult`
  (`ok` / `unauthorized` / `network-error`). 401 or 404 → `unauthorized` → clears `ldk_jwt` +
  `ldk_user` and `setUser(null)` so the guards redirect to `/login`; 5xx/network → keep the cached
  user (still transient-outage tolerant, which was the point of the original code).
- **Fix (`src/lib/api.ts` `apiFetch`):** on any `401`, clear `ldk_jwt` + `ldk_user` and
  `window.location.assign('/login')` (guarded so it won't fire on `/login`) so a mid-session expiry
  recovers gracefully instead of surfacing a generic error. Auth routes use `auth.ts` (NOT
  `apiFetch`), so this can't loop on the login page.
- **Verified:** `tsc --noEmit` + `vite build` clean; Playwright (local `:8080`) — planted an expired
  token + cached admin user, opened `/admin` → redirects to `/login`, clears both localStorage keys,
  renders the login form, shows neither error string (6/6 checks).
- **Deploy:** committed `ba1722e`, pushed to `main` → Amplify. Frontend-only; NO Lambda/DB change.
- **Immediate recovery (no deploy needed):** log out + back in for a fresh 7-day token.

**Mid-Level tier (2026-07-14, prior session) — SHIPPED & DEPLOYED.** (Documented retroactively in
session 6; not logged when built.) Made the quiz tier-aware (was Junior-only) + added a Junior/Mid-Level
selector; Junior behavior unchanged. Commits `0d1caf7` (feat) + `9fa1a5e` (cross-tier fix). Live
`/version`=`midlevel-2026-07-14`; both configs `is_active=1` (verified live 2026-07-27).
- **Content:** 60 Mid-Level questions in `FALLBACK_QUESTIONS` — A:8, B:14, C:10, D:8, E:10, F:10 (`ML-*`
  ids). Sections A–F with tier-specific labels (A=Value Engine, B=Producto/Master File, C=Acordeón,
  D=Canales, E=CORAA y operación, F=Pricing) in `TIER_SECTION_META`. `Section` type widened to A–F.
- **Rules:** Mid-Level passes on **≥90% overall only** — per-section error caps are Junior-only
  (`enforceSectionCaps = tier === 'junior'` in `certEligibility`/`calcScore`). Dynamic section buckets so
  D/E/F count; `/section-progress` includes D/E/F.
- **Schema:** migration `004_midlevel_sections.sql` — relaxed `answers.section` CHECK to A–F and set the
  mid-level `quiz_configs` row to `total_questions=60, section_count=6, is_active=1, threshold=0.9`.
  `quiz_attempts`/`certifications` tier CHECKs already allowed 'mid-level' (migration 001).
- **Cross-tier bleed fix (`9fa1a5e`) — DO NOT reintroduce:** switching tiers re-ran the data-loading
  effects, but a previous tier's in-flight requests could resolve AFTER the switch and overwrite the new
  tier's state — a Junior attempt/cert bled onto the Mid-Level badge ("phantom" Mid-Level cert after
  completing one section). Fixed with `cancelled` guards on both loader effects,
  `checkForActiveSessions`→`loadActiveSessions` (returns the map, applied under the guard), and
  DB-authoritative `earnedTiers` (badges from `GET /certifications`; stale localStorage tiers reconciled
  away). Keep tier-scoped effects cancellable.

**Session 4 (2026-06-10) — results-review UI changes (UI only; no Lambda/grading/question-bank changes).**
Verified `tsc --noEmit` clean + `vite build` OK. NOT yet committed/deployed at time of writing.
Files: `src/components/QuizResults.tsx`, `src/pages/Index.tsx`, `src/pages/AdminAttempt.tsx`, `src/lib/i18n.ts`.
- **Review cards now show question text + the agent's own answer + AI feedback + ✓/✗ status, always-expanded, untruncated.** `QuizResult` gained a `userAnswer` field; it's populated in both `sessionResults` pushes (`handleSubmitAnswer` success + catch) from the in-scope typed `answer`, and in the `allWrongReview` map from `WrongAnswer.userAnswer` (was being dropped). `AnswerReviewCard` rewritten: removed the accordion (`useState`) and the 68-char `result.question.slice(0,68)` truncation; green tint+left-border for correct, red for incorrect, with a "✓ Correcta"/"✗ Incorrecta" pill.
- **Review list is no longer wrong-only.** `reviewList` = full current-section `results` (correct+incorrect) when not all done; when all sections done it appends the cumulative cross-section wrongs (`allWrongAnswers`) deduped by id. Header string changed from `questionsWrong` ("Preguntas a repasar") to new neutral `answersReview` ("Tus respuestas"). NOTE limitation: after a RESUME, `results` only holds this-session answers (a small "Mostrando las respuestas de esta sesión" note is shown); cross-section *correct* answers can't be shown green on the final screen without a backend route (getWrongAnswers is wrong-only) — accepted.
- **Aggregate "Puntaje Total" added.** = sum(correct)/sum(answered) across attempted sections, shown only when 2+ sections have data, rendered above "Progreso general". Required threading the per-section `answered` count through `overallSections` (state + prop widened to `{section,correct,total,answered}`; the two `setOverallSections` calls in `handleNext` stopped stripping `answered`). This is DISTINCT from the existing `/55` cert-progress row (which intentionally keeps 55 as denominator).
- **Admin attempt cards show question text.** `AdminAttempt.tsx` `AnswerCard` now looks up `FALLBACK_QUESTIONS.find(q=>q.id===answer.question_id)?.question` and renders it (omitted if id not in bank); removed dead `questionTextShort` and the `maxHeight:120px` cap on the answer box.
- New i18n keys (en+es): `answersReview`, `totalScore`, `correctLabel`, `incorrectLabel`, `agentAnswer` (`questionsWrong` kept).
- **Verified at runtime** (Playwright on local dev `:8080`, login `test@ldk.lat`, completed Section B 13/13 through the real grader): review cards render with question text + agent answer + feedback + green ✓ Correcta / red ✗ Incorrecta; "Puntaje Total" (46/55 = 84%) shows above "Progreso general". Note surfaced (pre-existing, NOT this change): results can show "¡Certificada!" badge AND the "ya no es posible alcanzar el 90%" warning together — `certNotPossible` (certOnTrack===false) renders independently of the `certified` flag. Admin question-text change NOT runtime-verified (needs admin creds).

**Session 4 (2026-06-10) cont. — admin "Eliminate usuario" button (UNBLOCK new-user re-register).**
Ana (ana@ldk.lat) hit "Este correo ya está registrado" on register (correct — duplicate). The `DELETE /admin/users/:id` route was already LIVE in Lambda (session 2) but never wired into `api.ts`/UI. Added `adminDeleteUser` to `src/lib/api.ts` and a two-step confirm "Eliminar usuario" button in `Admin.tsx` Agentes tab (hidden for your own row; backend also blocks self-deletion). Frontend-only — no Lambda change. `tsc`+`vite build` clean. NOT runtime-verified (needs admin login; won't test-delete a real user).

**Session 4 (2026-06-10) cont. — email-based password reset via Resend — BUILT, PENDING DEPLOY + RESEND SETUP.**
`tsc`+`vite build` clean, `node --check lambda/index.mjs` OK, new pages render with no console errors (Playwright on `:8080`). NOT deployed; backend e2e (email delivery + token consumption) UNVERIFIED until deploy + migration + Resend are in place.
- **Token model:** new table `password_resets` (`migrations/003_password_resets.sql`) — id, user_id (FK CASCADE), `token_hash`=sha256(raw), expires_at, used_at. Only the hash is stored; raw token rides in the emailed link. Single-use (used_at) + time-limited; expiry computed/validated with `UTC_TIMESTAMP()` so it's session-tz-independent. Consuming a token invalidates all of that user's other outstanding tokens.
- **Lambda (`lambda/index.mjs`):** added `createHash` import; config `APP_BASE_URL` (def `https://quiz.ldk.fyi`), `RESEND_API_KEY`, `RESET_FROM` (def `LDK Ventas <no-reply@ldk.fyi>` — Resend-verified domain is **ldk.fyi**), `RESET_TTL_SELF`=1h, `RESET_TTL_INVITE`=72h. Helpers `sha256`, `createResetToken`, `sendResetEmail` (raw `fetch` to `api.resend.com/emails` — NO new npm dep, zip unchanged). Routes: `POST /auth/forgot` (public; ALWAYS 200, never leaks email existence), `POST /auth/reset` (public; validates token, sets scrypt hash), `POST /admin/users/:id/send-reset` (admin; 72h invite; 502 if Resend not configured). `/version` bumped to `password-reset-2026-06-10`.
- **Frontend:** `src/lib/auth.ts` `requestPasswordReset`/`resetPassword` (public, no auth header); `src/lib/api.ts` `adminSendPasswordReset`; new pages `src/pages/ForgotPassword.tsx` (`/forgot`) + `ResetPassword.tsx` (`/reset?token=`) — both PUBLIC routes in `App.tsx` (no auth wrapper so an emailed link works while logged in); `Login.tsx` "¿Olvidaste tu contraseña?" link → /forgot; `Admin.tsx` Agentes tab "Enviar restablecimiento" button per user. Auth pages stay inline-Spanish (no LANG), matching Login/Register.
- **Provider = Resend** (chosen over SES to avoid sandbox). **USER SETUP REQUIRED before it works:** create Resend account, verify a sending domain (ldk.lat or ldk.fyi) via DNS, create API key, confirm the `from` address; then set `RESEND_API_KEY` (+ optionally `APP_BASE_URL`, `RESET_FROM`) in the **ldk-quiz-api** Lambda env (the `wsi4x…` URL, NOT the grader). **DEPLOY ORDER:** run migration 003 on RDS → upload `lambda.zip` to ldk-quiz-api (confirm `/version`=`password-reset-2026-06-10`) → set env vars → push frontend to `main`.
**STATUS 2026-06-10:** ✅ migration 003 applied to RDS (password_resets table live); ✅ lambda.zip uploaded to ldk-quiz-api + RESEND_API_KEY set (Resend domain = ldk.fyi, sender no-reply@ldk.fyi); ✅ backend smoke-tested live (`/version`=password-reset-2026-06-10; `/auth/forgot` unknown email→200; `/auth/reset` bad token→400 "inválido o ha expirado" — proves table is queryable). ✅ frontend pushed to `main` + Amplify deployed (quiz.ldk.fyi — "¿Olvidaste tu contraseña?" link confirmed visible on the live login page). ⏳ REMAINING: user to confirm an actual reset email lands + the full forgot→email→/reset→login flow. Actual Resend email DELIVERY not yet confirmed by us (the /forgot route swallows send errors and always 200s; verify by checking an inbox, or via the admin send-reset which 502s on Resend failure). Connecting to RDS from the dev machine works (TCP 3306 reachable) — used a one-off `mysql2` script (env-var creds, deleted after) to run the migration; no migration-runner committed.

**Session 3 (2026-06-09) — P0 cumulative certification — SHIPPED & DEPLOYED.**
Lambda live (`/version` = `cumulative-cert-2026-06-09`); frontend committed `b4aede4` + memory `d000c05`,
pushed to `main` → Amplify auto-deploy. **Fernanda certified** (admin override on one of her attempts
triggered the cumulative auto-grant — P2 done). Implementation details below (was: "code complete,
pending deploy").
Implemented + reviewed via a 4-lens adversarial workflow (7 findings confirmed & all fixed; 8 dismissed
as latent/pre-existing). Verified: `tsc --noEmit` clean, `node --check lambda/index.mjs` OK, 29/29
vitest, `vite build` OK.
- **Cumulative cert is now server-authoritative.** New `certEligibility(conn,userId,tier)` in
  `lambda/index.mjs`: best-grade-per-DISTINCT-question (`MAX(final_grade)` `GROUP BY question_id`, the
  leaderboard convention) across all `('passed','failed')` attempts, vs config `total_questions`/
  `passing_threshold` and ≤5-errors/section. Returns `section_correct`/`section_answered` breakdowns too.
  New `syncCertification(conn,userId,tier)` grant-only auto-grant (INSERT wrapped in try/catch so a
  failed insert still returns eligibility). Called from `POST /attempts/:id/complete` and
  `POST /admin/answers/:id/override`; both return `cert` in the response. New `GET /users/:id/cert-status`.
- **Denominator fix.** Override recalc + frontend `handleDiscardAndStart` now score a section against
  ITS OWN question count (28/13/14), never 55. Per-section `score_percent` is display-only; the tier
  cert no longer depends on any single attempt.
- **Frontend** (`Index.tsx`, `QuizResults.tsx`, `scoring.ts`, `api.ts`): cert badge/justEarned driven by
  `result.cert` (falls back to `getCertStatus()` when the response has no `cert` — covers the deploy
  window where new FE talks to old Lambda). Results verdict (`passed`), per-section "Progreso general"
  rows, and cumulative count now come from the backend's deduped numbers, so the on-screen ✓/✗ and
  retake banner can never contradict the granted badge. Celebration banner gated on `justEarned` alone.
  Removed the unreachable `result.passed && sectionsDone` grant path and the unused `grantCertification`
  import.
- **DEPLOY ORDER MATTERS:** Lambda (`lambda.zip` → `ldk-quiz-api`, the `wsi4x…` URL) must go FIRST, then
  push frontend to `main` for Amplify. `/version` now returns `cumulative-cert-2026-06-09`. After deploy,
  repair Fernanda (P2): re-complete or re-override one of her attempts to trigger the cumulative grant,
  and discard her in-progress attempt #4.


From CLAUDE.md (as of June 8, 2026) and progress.md:

- `handleResume` crash — `savedBreak.answers` didn't exist on `SavedBreak` type.
- `GET /attempts/:id/answers` was missing from Lambda — added (own-attempt break/resume).
- Cross-device break/resume — saved-session card now appears correctly.
- Section progress bars — Sec A/B/C show visual fill + "X/N respondidas".
- Resume from section card resumes at the correct question.
- Multiple in-progress sessions — home shows ALL sections with saved progress at once.
- Highest-answered attempt wins per section — `active-attempts` orders by answer count DESC.
- AI coaching CORS error — OPTIONS handler added to grader Lambda.
- Pause/break button visible during active session.
- Only 7/28 answers saved — `saveAnswerToAttempt` now also called in grader catch block.
- NaN% score — `liveTotal` used `||` instead of `??` to avoid 0/0.
- Mid-quiz red ✗ — pass/fail only evaluated once all 3 sections done; motivational until then.
- `completeAttempt` used 55 for all sections — now uses `sessionQuestions.length` per section.
- `getUserProgress` returned 0 — now SUMs `final_grade` from answers across passed+failed attempts.
- CORRECTAS partial count — uses `result.total_correct` from `completeAttempt`.
- PREGUNTAS A REPASAR — new `GET /users/:id/wrong-answers`; full question text shown.
- Leaderboard last-section-only — now counts DISTINCT correct `question_id`s; total hardcoded 55.
- Leaderboard badge — shows ★ JUNIOR (tier) instead of "CERTIFICADA".
- "0/0 acumuladas" on home — wired to `getUserProgress`.
- Results screen conflated the cumulative cross-section total with the section score (showed e.g. `21/30` and a `70%` headline for a 28-q section). Split into two labeled blocks — "Esta sección" (section-only %, 28 total) and "Progreso general" (per-section rows + grand total `X/55` + overall %). Added a certification on-track indicator (amber when `(correct + remaining)/55 < threshold`). Per-section breakdown is derived frontend-side from `getSectionProgress` + `getWrongAnswers` + `getSectionCounts`; `JUNIOR_TOTAL_QUESTIONS=55` constant added to `scoring.ts`. Files: `QuizResults.tsx`, `Index.tsx`, `i18n.ts`, `scoring.ts`.
- Quiz buttons froze (March) — `handleSectionStart` switches screen immediately, attempt creation runs in background.
- Lambda runtime Node 24 → 22 (Anthropic SDK layer incompatibility); removed `@anthropic-ai/sdk`, use raw `fetch`.
- Grader JSON parse — handles markdown fences and missing braces.
- Admin bootstrap chicken-and-egg — `kay@ldk.lat` had `is_admin=0` in DB (auto-grant only fires at *registration*, and kay predated it), so every `/admin/*` route returned 403. Fixed by making the admin guard in `lambda/index.mjs` honor `ADMIN_EMAILS` by email **in addition to** the DB flag, and self-heal (`UPDATE users SET is_admin=1`) on first admin hit. Resolves NEXT PRIORITY #1.

---

## 11b. SESSION 2 ADDITIONS (2026-06-09)

- **New route `DELETE /admin/users/:id`** (`lambda/index.mjs`, admin block) — hard-deletes a user; FK `ON DELETE CASCADE` wipes their attempts/answers/certs. Guard blocks self-deletion (`seg[2] === claims.sub`). Used to delete `fernanda@ldk.lat` so she could re-register from scratch (done & verified).
- **New route `GET /version`** (`lambda/index.mjs`, before auth) — deploy marker `{version:'admin-delete-2026-06-09', adminGuardHonorsEmails:true}`. Handy to confirm which code is live without auth.
- **Admin guard now honors `ADMIN_EMAILS` + self-heals `is_admin`** (see fixed-bugs above).
- **DEPLOY GOTCHA discovered & burned a lot of time:** the two Function URLs are easy to confuse — `wsi4x…` = **ldk-quiz-api** (auth/quiz/admin, file `index.mjs`), `b5sk5…` = **ldk-quiz-grader** (grading only, file `grader-deploy.mjs` deployed AS `index.mjs`, handler `index.handler`). `lambda.zip` was repeatedly uploaded to the GRADER by mistake, which (a) never updated the API and (b) clobbered the grader with API code, breaking grading. Both were corrected: `lambda.zip` → ldk-quiz-api, and a fresh `grader.zip` (grader-deploy.mjs renamed to index.mjs, no node_modules) → ldk-quiz-grader. **Always confirm the green banner names the intended function.**

---

## 12. DEPLOYMENT PROCESS

**Frontend (React/Amplify):**
1. Commit and push to `main` on GitHub (`kaho1312/ldk-sales-team-evaluation`).
2. Amplify auto-builds (with `npm install`, NOT `npm ci`) and deploys to quiz.ldk.fyi.

**Lambda (`ldk-quiz-api` — `lambda/index.mjs`):** (AWS CLI is NOT installed)
1. In VS Code terminal:
   `Compress-Archive -Force -Path lambda\index.mjs, lambda\node_modules, lambda\package.json -DestinationPath lambda.zip`
2. AWS Console → Lambda → `ldk-quiz-api` → Code → Upload from → .zip → select `lambda.zip` → Save.

**Lambda (`ldk-quiz-grader` — `lambda/grader-deploy.mjs`):** (VERIFIED 2026-06-09)
- Single file, no deps (raw `fetch`). Deployed handler is `index.handler`, so the zip must contain the grader code **named `index.mjs`** (NOT `grader-deploy.mjs`) and needs **no node_modules**. Build: copy `grader-deploy.mjs`→`index.mjs` into a temp dir, `Compress-Archive` that one file → upload to `ldk-quiz-grader`. Never enable CORS on the Function URL.
- ⚠️ Upload to the RIGHT function: `b5sk5…` URL = grader, `wsi4x…` URL = api. Confirm the success banner names `ldk-quiz-grader`.

**Database (RDS MySQL):**
- Run migration SQL from `migrations/*.sql` against RDS manually. Exact runner/connection method UNKNOWN — VERIFY with user. Admin bootstrap: `UPDATE users SET is_admin=1 WHERE email='...'` after first login.

---

## 13. SESSION END CHECKLIST

Before closing a session, update this file:

- [ ] Move any newly-fixed bugs from KNOWN ISSUES → RECENTLY FIXED BUGS.
- [ ] Add any new open bugs to KNOWN ISSUES with status + notes.
- [ ] Update NEXT PRIORITIES order / mark completed items.
- [ ] Record any new endpoints, routes, or env vars in sections 4/5.
- [ ] Note any schema/migration changes (new `migrations/*.sql`).
- [ ] Reconcile any repo-vs-deployed divergences discovered (esp. grader).
- [ ] Confirm CLAUDE.md and memory.md don't contradict each other (domain, bug list).
- [ ] Resolve any `UNKNOWN — verify` items that got answered this session.

---

## 14. NEXT PRIORITIES

Re-ordered 2026-06-09 (session 3). P0 (cumulative certification) is **DONE & DEPLOYED**; the next
build is the "TU PROGRESO" UI improvement.

**✅ P0 — Make certification reachable — DONE & DEPLOYED (session 3).** See §10b + §11. Cumulative
server-side auto-grant; per-section denominator fixes; new `GET /users/:id/cert-status`. Lambda live
(`/version`=`cumulative-cert-2026-06-09`), frontend pushed `b4aede4` → Amplify. **P2 (repair Fernanda)
also DONE** — she's certified.

**NEXT — "TU PROGRESO" home-screen improvement.** See **§10c** for the full spec. Show correct/wrong/
unanswered per section, fix the stale-green-on-retake bug, and fix the "56/56" footer (reuse
`GET /cert-status`). ⚠️ **One open product question first:** the retake scoring model (keep-best vs
replace vs wipe) — ASK the user before building.

**Quick UI follow-ups (requested 2026-06-10, session 4 — small, NOT yet built):**
1. **Login copy (ES) — `src/pages/Login.tsx`:** change the reset-link text `¿Olvidaste tu contraseña?`
   → `Olvidé mi contraseña`, and the register prompt `¿No tienes cuenta?` → `No tienes cuenta?` (drop
   the leading `¿`). Both strings live in `Login.tsx`. (Register.tsx has a mirror `¿Ya tienes cuenta?`
   — leave it unless the user asks for consistency.)
2. **Admin answer frame by AI grade — `src/pages/AdminAttempt.tsx` (`AnswerCard`):** put a colored
   frame on the "RESPUESTA DEL AGENTE" answer box — **green** border when the AI graded correct
   (`ai_grade===true`), **red** when incorrect (`ai_grade===false`), neutral when `null` — so
   right/wrong is obvious at a glance (per user screenshot). The card already derives an outer
   `borderColor` from `final_grade`; this is specifically the inner answer box, keyed to the AI grade.
3. **Correct/incorrect filter in the admin attempt view — `src/pages/AdminAttempt.tsx`:** add a filter
   control at the top (near "Resumen de puntaje") with Todas / Correctas / Incorrectas, filtering the
   answers list below by effective `final_grade`. Helps navigate long attempts (e.g. 28-answer Sec. A).

**✅ P1 — Stop the grader fabricating wrong answers — DONE & DEPLOYED (session 6c+6d, 2026-07-28).**
See §10b Layer 3 (closed) + §11 (sessions 6c/6d) for full detail. Grader returns `{error:true,
error_detail}` on failure + retries 429/5xx with backoff + `max_tokens` raised to 1024; frontend detects
`data.error` and does NOT persist a grading-service failure as wrong — shows a retry banner instead.

**P3 — Close test gap + data hygiene.** Add a test for the BACKEND per-section→cumulative cert flow
(current Scenarios 1–2 only cover the dead localStorage path). Fix "discarded attempts pollute
cumulative counts" (§10) — though the best-grade-wins cumulative model already tolerates it for cert.

**Admin panel — remaining open items:**
- Human review of wrong/failed answers — `POST /admin/answers/:id/override` + recalc exist and
  `AdminAttempt` cards now show the question text (session 4); the override/grade UX is usable but
  could use polish (and an audit log).
- Question upload interface — add/edit/delete Junior questions without touching code (CSV parser +
  `quiz_configs.questions_source_url` exist as a starting point).
- Hardening — role-guard routes, **audit log of overrides + password resets**.
- Small fix: gate the results-screen `certNotPossible` warning on `!certified` (see §10).

**Done 2026-06-10 (session 4):**
- Results-review UI — review cards show question text + agent answer + AI feedback + green ✓/red ✗,
  always-expanded/untruncated; aggregate "Puntaje Total" (correct÷attempted) above the per-section
  breakdown; `AdminAttempt` cards show the question text. Verified at runtime (Playwright). Pushed/live.
- Admin "Eliminar usuario" button wired to the existing `DELETE /admin/users/:id` — used to unblock
  Ana (ana@ldk.lat), who re-registered successfully.
- Email-based password reset via **Resend** — migration `003` applied; `POST /auth/forgot`,
  `POST /auth/reset`, `POST /admin/users/:id/send-reset` live; `/forgot` + `/reset` pages, Login
  "¿Olvidaste tu contraseña?" link, Admin "Enviar restablecimiento" button. Backend smoke-tested;
  frontend live. **Only the real email-delivery leg is left for the user to confirm** (see §10).

**Done 2026-06-09 (session 2):** Admin access for Kay (guard honors `ADMIN_EMAILS` + self-heals
`is_admin=1`); Fernanda deleted to re-register fresh; `GET /admin/users` confirmed only 3 users.

**Senior tier — LIVE & VERIFIED via Google Sheet (session 6b, now 61 questions as of 6f).** All three
tiers now have questions and are live. Remaining Senior follow-ups (nice-to-have, not blocking):
(a) surface sheet parse errors in the admin UI (currently swallowed — a bad sheet just leaves the tier
locked with no message); (b) mind the id-stability caveat (§6b) before REORDERING existing sheet rows
mid-cohort — appending new questions, as done in 6f, is safe; (c) optionally migrate Junior/Mid-Level to
the same sheet-driven model for consistency (currently hardcoded).

**Done 2026-07-28 (session 6, full day — all shipped & live, see §11 sessions 6c–6h for detail):**
- Grader LLM provider swapped Anthropic → DeepSeek (old key was rejecting 100% of calls); grading
  verified live with correct/incorrect/blank probes.
- Closed the long-standing P1 above: a grading-service failure (outage, timeout, malformed response) no
  longer gets saved as a wrong answer — shows a retry banner, persists nothing. Caught a real state-leak
  bug via 2-lens adversarial review that manual testing alone missed.
- Senior sheet grew 60→61 questions (user hand-edit); sheet parser fixed to not require the literal
  "Respuesta:" label on answer rows (it silently dropped 2 questions when that label was omitted).
- Leaderboard rewritten twice per live user feedback: first to stop showing a Junior-scoped score next
  to a higher earned tier's badge, then to show cumulative correct/total across the WHOLE curriculum
  (Junior+Mid-Level+Senior = 176) instead of just the best tier.
- Leaderboard certification badges color-coded by tier (teal/blue/amber, matching Admin.tsx's existing
  convention) — previously every certified badge looked identical regardless of tier.
- (Earlier same day) admin panel expired-session fix, Mid-Level reconciliation, Senior Google-Sheet
  loader shipped, config threshold-clobber bug fixed, CSV-export gid=0 bug fixed.
