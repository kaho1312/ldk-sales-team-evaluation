# LDK Sales Team Evaluation

## Project
Certification quiz app for the LDK DMC sales team. Agents complete open-ended questions graded by Claude AI, earn Junior/Mid-Level/Senior certifications based on cumulative score across all questions in a tier.

## Infrastructure
- **Hosting**: AWS Amplify → quiz.ldk.lat
- **Database**: Supabase → https://eqwrrcgclzaxvqglpqzj.supabase.co
- **AI grading**: AWS Lambda (Claude Haiku via n8n)
- **GitHub**: kaho1312/ldk-sales-team-evaluation
- **Dev branch convention**: `claude/...` branches, merge to `main` to deploy

## Environment variables (set in Amplify console)
```
VITE_SUPABASE_URL=https://eqwrrcgclzaxvqglpqzj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_M2P6oXR1qRjfb9-7f8mKAQ_SkzOFiOx
```

## Stack
- React + Vite + TypeScript + Tailwind CSS + shadcn/ui (dark theme)
- Supabase Auth (restricted to @ldk.lat emails)
- @supabase/supabase-js client

## Certification logic
- Junior: 55 questions across 3 sections (A: 28, B: 13, C: 14)
- Pass requires BOTH: ≥50/55 correct overall AND no section with >5 errors
- Mid-Level and Senior: structure ready in DB, questions TBD

## Key files
- `src/lib/api.ts` — all Supabase operations
- `src/lib/scoring.ts` — certification scoring logic
- `src/lib/auth.ts` — Supabase Auth (register/login/logout)
- `src/context/AuthContext.tsx` — reactive auth session
- `src/pages/Index.tsx` — main quiz flow
- `src/pages/Admin.tsx` — admin dashboard (/admin)
- `src/pages/AdminAttempt.tsx` — per-attempt answer review (/admin/attempt/:id)
- `src/lib/questions.ts` — 55 hardcoded Junior questions + CSV loader
- `supabase/migrations/001_initial_schema.sql` — DB schema (already applied)

## WAT framework
This project follows the WAT (Workflows, Agents, Tools) architecture:
- Workflows: markdown SOPs in `workflows/`
- Agents: AI coordination layer (this file defines context)
- Tools: deterministic scripts in `tools/`
Keep workflows updated as the system evolves. Don't create or overwrite workflows without asking.
