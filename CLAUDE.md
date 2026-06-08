# LDK Sales Team Evaluation

## Project
Certification quiz app for the LDK DMC sales team. Agents complete open-ended questions graded by Claude AI, earn Junior/Mid-Level/Senior certifications based on cumulative score across all questions in a tier.

## Infrastructure
- **Hosting**: AWS Amplify → quiz.ldk.fyi
- **Database**: AWS RDS MySQL (planned)
- **API backend**: AWS Lambda + API Gateway with Cognito auth
- **AI grading**: AWS Lambda (existing grader URL)
- **GitHub**: kaho1312/ldk-sales-team-evaluation
- **Dev branch convention**: `claude/...` branches, merge to `main` to deploy

## Environment variables (set in Amplify console)
```
VITE_GRADER_URL=https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/
VITE_GRADER_KEY=
```

## Stack
- React + Vite + TypeScript + Tailwind CSS + shadcn/ui (dark theme)
- AWS Cognito Auth (restricted to @ldk.lat emails)
- AWS Lambda + API Gateway for backend persistence

## Certification logic
- Junior: 55 questions across 3 sections (A: 28, B: 13, C: 14)
- Pass requires BOTH: ≥50/55 correct overall AND no section with >5 errors
- Mid-Level and Senior: structure ready in DB, questions TBD

## Key files
- `src/lib/api.ts` — backend API wrapper (will be reimplemented for AWS)
- `src/lib/scoring.ts` — certification scoring logic
- `src/lib/auth.ts` — Cognito Auth adapter (register/login/logout)
- `src/context/AuthContext.tsx` — reactive auth session / profile lookup
- `src/pages/Index.tsx` — main quiz flow
- `src/pages/Admin.tsx` — admin dashboard (/admin)
- `src/pages/AdminAttempt.tsx` — per-attempt answer review (/admin/attempt/:id)
- `src/lib/questions.ts` — 55 hardcoded Junior questions + CSV loader
- `supabase/migrations/001_initial_schema.sql` — original DB schema; translate to MySQL

## WAT framework
This project follows the WAT (Workflows, Agents, Tools) architecture:
- Workflows: markdown SOPs in `workflows/`
- Agents: AI coordination layer (this file defines context)
- Tools: deterministic scripts in `tools/`
Keep workflows updated as the system evolves. Don't create or overwrite workflows without asking.
