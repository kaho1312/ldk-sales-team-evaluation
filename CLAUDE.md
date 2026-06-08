# LDK Sales Team Evaluation

## Project
Certification quiz app for the LDK sales team. Open-ended questions graded by Claude AI. Agents earn Junior/Mid-Level/Senior certifications based on cumulative score.

## Active source
ALL active code lives in `src/`. Root-level `.tsx` files (Index.tsx, Leaderboard.tsx, etc.) are old drafts — DO NOT edit them.

## Infrastructure
- **Hosting**: AWS Amplify → quiz.ldk.fyi
- **Database**: AWS RDS MySQL — LIVE and connected
- **Backend**: AWS Lambda `ldk-quiz-api` — handles auth, RDS, attempts, answers, progress
- **Grader**: AWS Lambda `ldk-quiz-grader` — grades answers via Claude Haiku API
- **Lambda API URL**: https://wsi4xjvsewtoshfwqc2m2e24t40yvczk.lambda-url.us-east-1.on.aws/
- **Lambda Grader URL**: https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/
- **GitHub**: kaho1312/ldk-sales-team-evaluation (push to main → Amplify auto-deploys)
- **Branch**: main (not master)

## Deploying Lambda changes
AWS CLI is NOT installed. To deploy `lambda/index.mjs` changes:
1. In VS Code terminal: `Compress-Archive -Force -Path lambda\index.mjs, lambda\node_modules, lambda\package.json -DestinationPath lambda.zip`
2. AWS Console → Lambda → ldk-quiz-api → Code → Upload from → .zip file → select `lambda.zip` → Save

## CORS rule — DO NOT CHANGE
CORS is handled in Lambda code only. Never enable CORS in AWS Function URL settings. Doing so creates duplicate headers (`*, *`) and breaks all requests.

## Stack
- React + Vite + TypeScript + Tailwind CSS + shadcn/ui (dark theme)
- Custom JWT auth (NOT Cognito) — restricted to @ldk.lat emails
- AWS Lambda + RDS MySQL for all persistence

## Certification logic
- Junior: 55 questions — Section A: 28, B: 13, C: 14
- Pass = ≥50/55 correct AND no section with >5 errors
- Mid-Level and Senior: DB structure exists, questions not yet written

## Key source files
- `src/pages/Index.tsx` — main quiz flow, break/resume logic
- `src/pages/Login.tsx` / `Register.tsx` — auth pages
- `src/pages/Admin.tsx` / `AdminAttempt.tsx` — admin dashboard
- `src/lib/api.ts` — all backend API calls (RDS via Lambda)
- `src/lib/auth.ts` — JWT login/logout/register
- `src/lib/questions.ts` — 55 hardcoded Junior questions
- `src/lib/scoring.ts` — pass/fail certification logic
- `src/context/AuthContext.tsx` — auth session provider
- `lambda/index.mjs` — ldk-quiz-api backend (auth, RDS, all routes)

## Current known bugs (updated June 8, 2026)
- ✅ FIXED: handleResume crash — savedBreak.answers didn't exist on SavedBreak type
- ✅ FIXED: GET /attempts/:id/answers missing from Lambda — deployed June 8
- ✅ FIXED: Cross-device break/resume working — "Tienes una sesión guardada" card appears correctly
- ✅ FIXED: Section progress bars — Sec.A/B/C now show visual fill + "X/N respondidas" count
- ✅ FIXED: Resume from section picker — clicking a section with saved progress resumes at correct question
- ✅ FIXED: Multiple in-progress sessions — home screen now shows ALL sections with saved progress simultaneously; removed separate saved-session card; sections are clickable cards with inline "Empezar de nuevo" option
- ✅ FIXED: Highest-answered attempt wins per section — getActiveAttempts orders by answer count DESC and frontend keeps first result per section
- 🔴 "0/0 respuestas correctas acumuladas" not pulling from RDS — needs to call getUserProgress and display real numbers
- 🔴 AI coaching shows "Error al conectar con el servidor de evaluación" — CORS OPTIONS handler missing in ldk-quiz-grader Lambda
- 🔴 No pause button visible during active quiz session

## Home screen architecture (as of June 8, 2026)
- Section A/B/C are interactive cards in the "Tu Progreso" block — no separate section picker screen
- In-progress sections: highlighted cyan border, "Continuar desde pregunta X", inline "↩ Empezar de nuevo"
- Completed sections: green ✓, "Completada · Haz clic para repetir"
- Not started: neutral, click starts immediately
- Backend: `GET /users/:id/active-attempts` returns all in-progress attempts with answer counts per section
- Frontend: `activeSessions: Record<section, { attemptId, answeredCount }>` — keeps the attempt with most answers per section

## Next session priorities (in order)
1. Fix "respuestas correctas acumuladas" counter — wire to getUserProgress from RDS
2. Fix AI coaching CORS error — add OPTIONS handler to ldk-quiz-grader Lambda
3. Add pause button to quiz UI

## What NOT to do
- Do not edit root-level .tsx files — they are dead drafts
- Do not add Supabase dependencies — project is AWS-only
- Do not use `npm ci` in Amplify — use `npm install`
- Do not enable CORS in AWS Function URL settings
- Do not use Cognito — auth is custom JWT in ldk-quiz-api

## WAT framework
- Workflows: SOPs defined in this file
- Agent: Claude Code (you)
- Tools: `lambda/index.mjs`, `src/lib/api.ts`, Amplify deploy pipeline  