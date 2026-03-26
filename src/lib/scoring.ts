// ─────────────────────────────────────────────────────────────────────────────
// LDK Certification Scoring Logic
//
// Pass conditions (BOTH must be true):
//   1. overall_correct >= ceil(total_questions * passing_threshold)
//      e.g. ceil(55 * 0.90) = 50 out of 55
//   2. No single section has errors > floor(total_questions * 0.10)
//      e.g. floor(55 * 0.10) = 5 → any section with 6+ errors = fail
// ─────────────────────────────────────────────────────────────────────────────

export interface SectionErrors {
  A: number;
  B: number;
  C: number;
}

export interface ScoreResult {
  total_correct: number;
  total_questions: number;
  score_percent: number;
  section_errors: SectionErrors;
  passed: boolean;
  fail_reasons: string[];
}

export function calculateScore(
  answers: { section: string; final_grade: boolean | null }[],
  totalQuestions: number,
  passingThreshold = 0.9,
): ScoreResult {
  const minCorrect = Math.ceil(totalQuestions * passingThreshold);
  const maxSectionErrors = Math.floor(totalQuestions * 0.1);

  const sectionErrors: SectionErrors = { A: 0, B: 0, C: 0 };
  let totalCorrect = 0;

  for (const answer of answers) {
    const grade = answer.final_grade ?? false;
    if (grade) {
      totalCorrect++;
    } else {
      // Questions with section "All" count against section A for error tracking
      const sec = (answer.section === "All" ? "A" : answer.section) as keyof SectionErrors;
      if (sec in sectionErrors) sectionErrors[sec]++;
    }
  }

  const scorePercent = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  const failReasons: string[] = [];

  if (totalCorrect < minCorrect) {
    failReasons.push(
      `Puntaje general ${scorePercent}% está por debajo del 90% (se necesitan ${minCorrect}/${totalQuestions} correctas)`,
    );
  }

  for (const [sec, errors] of Object.entries(sectionErrors)) {
    if (errors > maxSectionErrors) {
      failReasons.push(
        `Sección ${sec} tiene ${errors} errores (máximo permitido: ${maxSectionErrors})`,
      );
    }
  }

  return {
    total_correct: totalCorrect,
    total_questions: totalQuestions,
    score_percent: scorePercent,
    section_errors: sectionErrors,
    passed: failReasons.length === 0,
    fail_reasons: failReasons,
  };
}
