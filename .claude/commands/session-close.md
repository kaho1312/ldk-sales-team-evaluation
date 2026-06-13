---
description: End-of-session checklist — update memory.md and generate progress note
---

# Session Close

Run this at the end of every Claude Code session. Work through each step in order.

## Step 1 — Update memory.md

Open `memory.md` and make the following updates:

1. **KNOWN ISSUES** — move any bugs fixed this session from KNOWN ISSUES → RECENTLY FIXED BUGS (§11). Add any new bugs discovered with status + notes.
2. **NEXT PRIORITIES (§14)** — mark completed items as Done with today's date. Re-order remaining priorities if anything changed.
3. **New routes or env vars** — add to §4 (Infrastructure) if any new Lambda routes or environment variables were added.
4. **Schema changes** — note any new `migrations/*.sql` files applied.
5. **Session summary line** — update the `# Last updated:` line at the top with today's date, session number, and a one-line summary of what shipped.

## Step 2 — Update CLAUDE.md

Check if anything in `CLAUDE.md` is now outdated:
- Known bugs section — reflect fixes
- Next session priorities — update order
- Any "DO NOT" rules to add based on what broke this session

## Step 3 — Consistency check

Confirm `CLAUDE.md` and `memory.md` don't contradict each other on:
- Lambda URLs
- Bug statuses
- Next priorities

Flag any contradictions explicitly before closing.

## Step 4 — Git commit

```powershell
git add memory.md CLAUDE.md
git commit -m "chore: session close — update memory and CLAUDE [skip ci]"
git push
```

## Step 5 — Final summary

Output a 3-5 bullet summary of:
- What was built/fixed this session
- What is deployed and live
- What is the single most important next step
