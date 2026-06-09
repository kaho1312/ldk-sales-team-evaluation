# LDK Sales Team Evaluation — Project Memory

# Last updated: 2026-06-09 (session 3 — root-caused "all answers right but no certification"; P0 fix in progress)

> Persistent project memory. Built from CLAUDE.md, progress.md, migrations, lambda code, and src. Keep this current at the end of every session (see SESSION END CHECKLIST).

---

## 1. WHAT THIS PROJECT IS

A certification quiz web app for the LDK DMC sales team (a Mexican inbound-tourism company). Sales agents log in with their `@ldk.lat` email and answer **open-ended** questions about products, daily operations, and platforms. Each answer is graded by Claude (Haiku) using lenient, interpretive criteria rather than exact-match. Agents accumulate correct answers across three sections (A, B, C) and earn a **Junior** certification when they pass; **Mid-Level** and **Senior** tiers exist in the schema but have no questions yet. The app is fully AWS-hosted (Amplify + Lambda + RDS MySQL) and uses custom JWT auth — no Cognito, no Supabase.

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
| `src/lib/questions.ts` | 55 hardcoded Junior questions (`FALLBACK_QUESTIONS`) + CSV/Google-Sheet parsers |
| `src/lib/scoring.ts` | Frontend pass/fail logic (`calculateScore`, `ScoreResult`) |
| `src/lib/progress.ts` | localStorage progress cache (fast path before backend loads) |
| `src/lib/i18n.ts` | ES/EN strings (`LANG`) |
| `src/context/AuthContext.tsx` | Auth session provider (`useAuth`) |
| `lambda/index.mjs` | `ldk-quiz-api` — auth, JWT, all RDS routes, admin routes, `calcScore` |
| `lambda/grader-deploy.mjs` | `ldk-quiz-grader` — Anthropic grading call + JSON parsing |
| `migrations/001_mysql_schema.sql` | RDS MySQL 8 schema (users, quiz_configs, quiz_attempts, answers, certifications) |
| `migrations/002_add_password.sql` | Adds `password_hash` for custom JWT auth |

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
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `ldk-quiz-api` Lambda env | RDS connection (`DB_NAME` defaults `ldk_quiz`) |
| `ANTHROPIC_API_KEY` | `ldk-quiz-grader` Lambda env | Anthropic API auth |

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
| Mid-Level | `total_questions=0`, `is_active=0` | ❌ not written | structure exists |
| Senior | `total_questions=0`, `is_active=0` | ❌ not written | structure exists |

**Question shape** (`QuizQuestion` in `src/lib/questions.ts`):
```ts
{ id, tier: "Junior"|"Mid-Level"|"Senior", section: "A"|"B"|"C"|"All",
  question, modelAnswer, tags?, notes? }
```
- Section labels: A = Operación diaria y producto · B = Herramientas del día a día (Acordeón) · C = Plataformas (CORAA, ODS).
- Questions are currently **hardcoded** and shipped in the frontend bundle. `parseQuestionsFromCSV()` and `fetchQuestionsFromSheet()` exist (CSV upload / published Google-Sheet CSV) but `Index.tsx` only uses `FALLBACK_QUESTIONS` today.
- `quiz_configs.questions_source_url` column exists for a future externalized question source (not wired into the quiz UI yet).

---

## 7. GRADING LOGIC

- **File:** `lambda/grader-deploy.mjs` (deployed as `ldk-quiz-grader`).
- **Model:** `claude-haiku-4-5-20251001`, `anthropic-version: 2023-06-01`, called via raw `fetch` to `https://api.anthropic.com/v1/messages`.
- **max_tokens:** 500.
- **Sent to Claude:** a Spanish system prompt instructing lenient/interpretive grading (approve on conceptual correctness even with different wording; fail only on factual errors, fundamental misunderstanding, or blank/irrelevant), plus a user message containing `section`, `question`, `modelAnswer` (reference), and the agent's `answer`.
- **Returned JSON:** `{"passed": bool, "feedback": "≤2 sentences in Spanish", "correct_answer": "text if failed, else null"}`. No `score` field is returned.
- **Parsing:** strip ```` ```json ```` fences, and if the text doesn't start with `{`, wrap it in braces, then `JSON.parse`. On any error → fallback `{passed:false, feedback:"Error al procesar la evaluación.", correct_answer:null}` and still returns HTTP 200.
- **Frontend handling** (`Index.tsx`): personalizes feedback ("el agente" → "tu respuesta"), caches to localStorage, and POSTs to `/attempts/:id/answers` (non-blocking).
- **Lambda memory size / timeout:** UNKNOWN — verify in AWS console.
- **No S3 / no handbook.** The deployed `ldk-quiz-grader` is a simple grader only — it does NOT load any handbook or read from S3. Its only env var is `ANTHROPIC_API_KEY`. (Older progress notes describing S3/handbook integration were plans that were never built.)

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
| Mid-Level & Senior questions not written | OPEN | configs are `is_active=0`, `total_questions=0` |
| Admin panel incomplete | OPEN | see NEXT PRIORITIES |
| **Certification never grants even with a perfect score** | OPEN (P0) — fix in progress | See §10b. Root cause confirmed in code. Fernanda answered all 55 correctly yet shows "Reprobado" on every attempt and no cert. |
| **Single section scored against the full 55-question tier** | OPEN (P0) — fix in progress | See §10b. A perfect 28-q Section A reads 28/55 = 51%; B = 24%; C = 25%. |
| **Grader marks correct answers wrong on any infra hiccup** | OPEN (P1) | See §10b. `max_tokens:500` truncation / 429 / timeout → fallback `{passed:false,"Error al procesar la evaluación."}` saved as `final_grade=false`. Source of "errores I couldn't reproduce". |

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

## 11. RECENTLY FIXED BUGS (do not reintroduce)

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

Re-ordered 2026-06-09 (session 3) — the certification/scoring root cause (§10b) now leads,
because it blocks the product's entire purpose (agents can't get certified). The admin-panel
items from session 2 follow.

**P0 — Make certification reachable (IN PROGRESS this session).** See §10b.
- Backend (`lambda/index.mjs`): add cumulative cert eligibility from the `answers` table
  (distinct best grade per `question_id` via `MAX(final_grade)` across `('passed','failed')`
  attempts, vs tier config `total_questions=55` / `passing_threshold=0.9` and ≤5 errors/section).
  Auto-grant the cert in `POST /attempts/:id/complete` (return cert status in the response) and on
  `POST /admin/answers/:id/override`. Add `GET /users/:id/cert-status`.
- Backend: fix the override-recalc denominator — score a section against its OWN question count and
  update the `total_questions` column (stop using `config.total_questions=55` for a single section).
- Frontend (`src/pages/Index.tsx`): drive the cert badge / "justEarned" from the backend `cert`
  field instead of `result.passed && sectionsDone`; fix `handleDiscardAndStart` to pass the section's
  question count, not `quizConfig` (55). Extend `ScoreResult`/api types (`src/lib/api.ts`).
- Deploy: `lambda.zip` → **ldk-quiz-api** (the `wsi4x…` URL — NOT the grader); push frontend to
  `main` for Amplify. Then repair Fernanda's data (P2).

**P1 — Stop the grader fabricating wrong answers.** See §10b Layer 3. On grader failure return a
distinct status (e.g. `{error:true}`) so the frontend does NOT persist it as `final_grade=false`
(retry / queue for re-grade). Raise `max_tokens` above 500 and add 1–2 retries w/ backoff for
429/529. File: `lambda/grader-deploy.mjs` (deploy as `index.mjs` → **ldk-quiz-grader** `b5sk5…`).

**P2 — Repair Fernanda's data.** Her 3 completed attempts hold all 55 correct (admin_override=1 on
many after Kay's review). Once P0 ships, trigger a cumulative recompute (re-complete or re-override)
to grant Junior; discard her in-progress attempt #4 (Section A, 1 answer) so it doesn't linger.

**P3 — Close test gap + data hygiene.** Add a test for the BACKEND per-section→cumulative cert flow
(current Scenarios 1–2 only cover the dead localStorage path). Fix "discarded attempts pollute
cumulative counts" (§10) — though the best-grade-wins cumulative model already tolerates it for cert.

**Admin panel (from session 2, still open):**
- Human review of wrong/failed answers — wire up UI (`POST /admin/answers/:id/override` + recalc
  exist; note recalc denominator is being fixed in P0).
- Question upload interface — add/edit/delete Junior questions without touching code (CSV parser +
  `quiz_configs.questions_source_url` exist as a starting point).
- Hardening — role-guard routes, audit log of overrides.

**Done 2026-06-09 (session 2):** Admin access for Kay (guard honors `ADMIN_EMAILS` + self-heals
`is_admin=1`); Fernanda deleted to re-register fresh; `GET /admin/users` confirmed only 3 users.

Beyond all of the above: write Mid-Level and Senior questions and activate their `quiz_configs`.
```
