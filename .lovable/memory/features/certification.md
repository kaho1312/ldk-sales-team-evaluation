Progress tracking system for LDK quiz certification. localStorage keyed by agent name, tracks correct/wrong question IDs.

## Architecture
- `src/lib/progress.ts` - localStorage progress tracking (correct/wrong arrays, certification check)
- 55 total questions, 90% threshold for "Junior Agent Certified"
- 15 random unanswered questions per session
- Wrong answers stay wrong until full retake
- Leaderboard shows all 6 preset agents with % and certified status

## Open-ended format
- Questions answered via textarea, not multiple choice
- AI grading placeholder (keyword heuristic) - TODO: replace with Claude edge function
- QuizQuestion component accepts onSubmitAnswer, grading/graded/isCorrect/feedback props
