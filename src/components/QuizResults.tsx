import { LANG, Lang } from "@/lib/i18n";
import { TIER_SECTION_META, Tier, Section } from "@/lib/questions";

interface QuizResult {
  id: string;
  question: string;
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
  userAnswer: string;
}

interface QuizResultsProps {
  lang: Lang;
  agentName: string;
  tier: Tier;
  earnedTier: string | null;
  section: string;
  results: QuizResult[];
  totalQuestions: number;
  cumulativeCorrect: number;
  cumulativeTotal: number;
  justEarned: boolean;
  allSectionsDone: boolean;
  // Authoritative cumulative certification result from the backend. When present it
  // decides pass/fail (so the verdict can never contradict the granted badge); the
  // frontend cumulativeScore is only a fallback for an older backend.
  certified?: boolean;
  sectionCorrect?: number;
  sectionScorePercent?: number;
  overallSections?: { section: string; correct: number; total: number; answered: number }[];
  certOnTrack?: boolean | null;
  allWrongAnswers?: QuizResult[];
  onRestart: () => void;
}

// Short section name for the overall-progress rows, e.g. "Sección A" / "Section A"
function sectionName(sec: string, lang: Lang): string {
  return lang === "es" ? `Sección ${sec}` : `Section ${sec}`;
}

// Always-expanded review card so a third party can read question + answer + feedback
// at a glance. Green (correct) / red (incorrect) left border + tint and a status pill
// make right/wrong obvious while scrolling. No truncation on any text element.
function AnswerReviewCard({ result, lang }: { result: QuizResult; lang: Lang }) {
  const t = LANG[lang];
  const correct = result.isCorrect;
  return (
    <div
      className={`rounded-lg mb-2 border border-l-4 px-3 py-2.5 space-y-2 ${
        correct
          ? "bg-success/5 border-success/20 border-l-success"
          : "bg-destructive/5 border-destructive/20 border-l-destructive"
      }`}
    >
      {/* Status pill + question id */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            correct
              ? "bg-success/10 text-success border border-success/20"
              : "bg-destructive/10 text-destructive border border-destructive/20"
          }`}
        >
          {correct ? `✓ ${t.correctLabel}` : `✗ ${t.incorrectLabel}`}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/60 shrink-0">{result.id}</span>
      </div>

      {/* Question text — full, untruncated */}
      <div className="text-sm text-foreground/90 leading-relaxed">{result.question}</div>

      {/* Agent's answer */}
      <div>
        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
          {t.agentAnswer}
        </div>
        <div className="text-xs text-foreground/80 bg-secondary/30 border border-border/40 rounded-lg px-2.5 py-2 leading-relaxed whitespace-pre-wrap">
          {result.userAnswer || <span className="text-muted-foreground/60 italic">—</span>}
        </div>
      </div>

      {/* AI feedback */}
      {result.feedback && (
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
            {lang === "es" ? "Retroalimentación IA" : "AI Feedback"}
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">{result.feedback}</div>
        </div>
      )}

      {/* Correct answer (only present for wrong answers when the grader returned one) */}
      {result.correctAnswer && (
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
            {lang === "es" ? "Respuesta correcta" : "Correct Answer"}
          </div>
          <div className="text-xs text-foreground/80 bg-success/5 border border-success/15 rounded-lg px-2.5 py-2 leading-relaxed">
            {result.correctAnswer}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuizResults({
  lang,
  agentName,
  tier,
  earnedTier,
  section,
  results,
  totalQuestions,
  cumulativeCorrect,
  cumulativeTotal,
  justEarned,
  allSectionsDone,
  certified,
  sectionCorrect,
  sectionScorePercent,
  overallSections,
  certOnTrack,
  allWrongAnswers,
  onRestart,
}: QuizResultsProps) {
  const t = LANG[lang];
  const correctCount = results.filter((r) => r.isCorrect).length;
  const wrongCount = results.filter((r) => !r.isCorrect).length;
  // Use backend-authoritative values when available (handles resume where sessionResults is partial)
  const displayCorrect = sectionCorrect ?? correctCount;
  const displayWrong = sectionCorrect !== undefined ? totalQuestions - sectionCorrect : wrongCount;
  // Review list shows the full set of answers for this section (correct + incorrect,
  // colour-coded) so a reviewer can scan right/wrong at a glance. When all sections are
  // done, also append the cumulative cross-section wrong answers from RDS (deduped by id
  // against the current session to avoid duplicate React keys / repeated cards).
  const reviewList =
    allSectionsDone && allWrongAnswers
      ? [...results, ...allWrongAnswers.filter((w) => !results.some((r) => r.id === w.id))]
      : results;
  // After a resume, `results` only holds answers given this session (not the full section).
  const partialSession = !allSectionsDone && totalQuestions > 0 && results.length < totalQuestions;
  const finalScore = sectionScorePercent ?? (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);
  const cumulativeScore = cumulativeTotal > 0 ? Math.round((cumulativeCorrect / cumulativeTotal) * 100) : 0;

  // Aggregate score across the sections that have data: total correct ÷ total attempted
  // (questions answered), shown only once 2+ sections have been attempted. Distinct from
  // the /55 cert-progress row below, which always uses the full tier as its denominator.
  const attemptedSections = (overallSections ?? []).filter((s) => s.answered > 0);
  const totalAttempted = attemptedSections.reduce((n, s) => n + s.answered, 0);
  const totalCorrectAcross = attemptedSections.reduce((n, s) => n + s.correct, 0);
  const puntajeTotal = totalAttempted > 0 ? Math.round((totalCorrectAcross / totalAttempted) * 100) : 0;
  const showPuntajeTotal = attemptedSections.length >= 2;
  // Verdict follows the backend's authoritative cumulative certification when available,
  // so the ✓/✗, pass/fail copy, and retake banner can never disagree with the granted
  // badge. Falls back to the frontend score only if the backend didn't report status.
  const passed = allSectionsDone && (certified ?? cumulativeScore >= 90);

  // Section label from the tier's metadata (Junior A/B/C, Mid-Level A–F). Falls
  // back to "Sección X" if a section has no metadata entry.
  const secMeta = TIER_SECTION_META[tier]?.[section as Section];
  const secTitle = secMeta
    ? (lang === "es" ? secMeta.title_es : secMeta.title_en)
    : (lang === "es" ? `Sección ${section}` : `Section ${section}`);
  const secDesc = secMeta ? (lang === "es" ? secMeta.desc_es : secMeta.desc_en) : "";
  const sectionLabel = secDesc ? `${secTitle} – ${secDesc}` : secTitle;

  return (
    <div>
      {/* Score circle */}
      <div
        className={`w-[68px] h-[68px] rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-4 ${
          !allSectionsDone
            ? "bg-primary/10 border-2 border-primary/30 text-primary"
            : passed
              ? "bg-success/10 border-2 border-success/35 text-success"
              : "bg-destructive/10 border-2 border-destructive/30 text-destructive"
        }`}
      >
        {!allSectionsDone ? "→" : passed ? "✓" : "✗"}
      </div>

      <div className="text-[52px] font-extrabold tracking-tighter text-center leading-none mb-1 text-primary">
        {finalScore}%
      </div>

      <div className="text-xs text-muted-foreground text-center mb-4">{t.thisSection}</div>

      <div className="text-center text-sm text-muted-foreground mb-1">
        {agentName}
        {earnedTier && (
          <span
            className={`ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              earnedTier === "Junior"
                ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                : earnedTier === "Mid-Level"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {earnedTier} Agent
          </span>
        )}
      </div>

      <div className="text-[11px] text-muted-foreground/50 text-center mb-5">{sectionLabel}</div>

      <div className="text-xl font-bold text-foreground text-center mb-1.5">
        {!allSectionsDone
          ? (cumulativeScore >= 80
              ? (lang === "es" ? "¡Excelente!" : "Great work!")
              : (lang === "es" ? "¡Buen trabajo!" : "Keep going!"))
          : passed ? t.passed : t.failed}
      </div>

      <div className="text-sm text-muted-foreground text-center leading-relaxed mb-6">
        {!allSectionsDone
          ? (cumulativeScore >= 80
              ? (lang === "es"
                  ? `¡Llevas ${cumulativeCorrect}/${cumulativeTotal} respuestas correctas! Sigue así para completar tu certificación.`
                  : `You have ${cumulativeCorrect}/${cumulativeTotal} correct so far! Keep it up to complete your certification.`)
              : (lang === "es"
                  ? `Llevas ${cumulativeCorrect}/${cumulativeTotal} correctas. Revisa las preguntas y continúa con la siguiente sección.`
                  : `You have ${cumulativeCorrect}/${cumulativeTotal} correct so far. Review and continue to the next section.`))
          : passed ? t.passMsg : t.failMsg}
      </div>

      {/* Just earned Junior badge — gated on the authoritative grant only (justEarned
          is set from the backend cert), never on the frontend-recomputed score. */}
      {justEarned && (
        <div
          className={`rounded-xl py-3 px-4 text-center mb-5 border ${
            earnedTier === "Mid-Level"
              ? "bg-blue-500/10 border-blue-500/20"
              : earnedTier === "Senior"
                ? "bg-amber-500/10 border-amber-500/20"
                : "bg-teal-500/10 border-teal-500/20"
          }`}
        >
          <div className="text-lg mb-1">🎉</div>
          <div
            className={`text-sm font-bold ${
              earnedTier === "Mid-Level"
                ? "text-blue-400"
                : earnedTier === "Senior"
                  ? "text-amber-400"
                  : "text-teal-400"
            }`}
          >
            {lang === "es"
              ? `¡Felicidades! Ahora eres ${earnedTier} Sales Agent`
              : `Congratulations! You are now a ${earnedTier} Sales Agent`}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-2.5 mb-5">
        <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
          <div className="text-2xl font-extrabold text-success mb-1">{displayCorrect}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.correct_count}</div>
        </div>
        <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
          <div className="text-2xl font-extrabold text-destructive mb-1">{displayWrong}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.wrong_count}</div>
        </div>
        <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
          <div className="text-2xl font-extrabold text-muted-foreground/50 mb-1">{totalQuestions}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.total}</div>
        </div>
      </div>

      {/* Aggregate score across attempted sections (correct ÷ attempted) — shown once
          2+ sections have data, above the per-section breakdown. */}
      {showPuntajeTotal && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              {t.totalScore}
            </div>
            <div className="text-xs text-muted-foreground/70 mt-0.5 tabular-nums">
              {totalCorrectAcross}/{totalAttempted} {lang === "es" ? "respondidas" : "answered"}
            </div>
          </div>
          <div className="text-4xl font-extrabold tracking-tighter text-primary tabular-nums">{puntajeTotal}%</div>
        </div>
      )}

      {/* Block 2 — Overall progress */}
      {overallSections && overallSections.length > 0 && (
        <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2.5">
            {t.overallProgress}
          </div>
          <div className="flex flex-col gap-1.5 mb-3">
            {overallSections.map((s) => {
              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={s.section} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{sectionName(s.section, lang)}</span>
                  <span className="text-foreground/70 tabular-nums">
                    {s.correct}/{s.total} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
            <span className="text-xs font-bold text-foreground">
              {cumulativeCorrect}/{cumulativeTotal}{" "}
              <span className="font-normal text-muted-foreground/60">{t.cumulativeCorrect}</span>
            </span>
            <span className="text-sm font-extrabold text-primary tabular-nums">{cumulativeScore}%</span>
          </div>
          {certOnTrack === false && (
            <div className="bg-warning/5 border border-warning/15 rounded-lg py-2 px-3 mt-3 text-[11px] text-warning text-center leading-snug">
              {t.certNotPossible}
            </div>
          )}
        </div>
      )}

      {/* Section completed banner */}
      <div className="bg-success/8 border border-success/25 rounded-xl py-2.5 px-4 text-center mb-5">
        <span className="text-xs font-bold text-success">
          ✓ {sectionLabel} {lang === "es" ? "completada" : "completed"}
        </span>
      </div>

      {/* Answers list — full question + agent answer + AI feedback, colour-coded ✓/✗ */}
      {reviewList.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
            {t.answersReview}
          </div>
          {partialSession && (
            <div className="text-[11px] text-muted-foreground/60 mb-2 leading-snug">
              {lang === "es"
                ? "Mostrando las respuestas de esta sesión."
                : "Showing this session's answers."}
            </div>
          )}
          {reviewList.map((r) => (
            <AnswerReviewCard key={r.id} result={r} lang={lang} />
          ))}
        </div>
      )}

      {/* Retake warning — only after all sections are done and the final score didn't pass */}
      {allSectionsDone && !passed && (
        <div className="bg-warning/5 border border-warning/15 rounded-xl py-2.5 px-4 text-sm text-warning text-center mb-4">
          {t.retakeIn}
        </div>
      )}

      <button
        className="w-full bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-semibold py-3 mt-2.5 hover:border-muted-foreground/30 hover:text-foreground/60 transition-all"
        onClick={onRestart}
      >
        ← {t.startOver}
      </button>
    </div>
  );
}
