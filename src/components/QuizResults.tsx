import { useState } from "react";
import { LANG, Lang } from "@/lib/i18n";

interface QuizResult {
  id: string;
  question: string;
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
}

interface QuizResultsProps {
  lang: Lang;
  agentName: string;
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
  overallSections?: { section: string; correct: number; total: number }[];
  certOnTrack?: boolean | null;
  allWrongAnswers?: QuizResult[];
  onRestart: () => void;
}

// Short section name for the overall-progress rows, e.g. "Sección A" / "Section A"
function sectionName(sec: string, lang: Lang): string {
  return lang === "es" ? `Sección ${sec}` : `Section ${sec}`;
}

function AnswerReviewCard({ result, lang }: { result: QuizResult; lang: Lang }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-destructive/5 border border-destructive/10 rounded-lg mb-2 overflow-hidden">
      <button
        className="w-full text-left py-2.5 px-3 flex items-start justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm text-muted-foreground leading-snug">
          {result.id} · {result.question.length > 68 ? result.question.slice(0, 68) + "…" : result.question}
        </span>
        <span className="text-[11px] text-muted-foreground/50 shrink-0 mt-0.5">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="border-t border-destructive/10 px-3 py-2.5 space-y-2">
          <div className="text-xs text-foreground/70 leading-relaxed">{result.question}</div>
          {result.feedback && (
            <div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
                {lang === "es" ? "Retroalimentación IA" : "AI Feedback"}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">{result.feedback}</div>
            </div>
          )}
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
      )}
    </div>
  );
}

export function QuizResults({
  lang,
  agentName,
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
  // When all sections are done, use full RDS wrong-answer list; otherwise use current session
  const reviewList = allSectionsDone && allWrongAnswers ? allWrongAnswers : results.filter((r) => !r.isCorrect);
  const finalScore = sectionScorePercent ?? (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0);
  const cumulativeScore = cumulativeTotal > 0 ? Math.round((cumulativeCorrect / cumulativeTotal) * 100) : 0;
  // Verdict follows the backend's authoritative cumulative certification when available,
  // so the ✓/✗, pass/fail copy, and retake banner can never disagree with the granted
  // badge. Falls back to the frontend score only if the backend didn't report status.
  const passed = allSectionsDone && (certified ?? cumulativeScore >= 90);

  const sectionLabel =
    section === "A"
      ? lang === "es"
        ? "Sección A – Operación"
        : "Section A – Operations"
      : section === "B"
        ? lang === "es"
          ? "Sección B – Acordeón"
          : "Section B – Acordeón"
        : lang === "es"
          ? "Sección C – Plataformas"
          : "Section C – Platforms";

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
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl py-3 px-4 text-center mb-5">
          <div className="text-lg mb-1">🎉</div>
          <div className="text-sm font-bold text-teal-400">
            {lang === "es"
              ? "¡Felicidades! Ahora eres Junior Sales Agent"
              : "Congratulations! You are now a Junior Sales Agent"}
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

      {/* Wrong questions list with feedback */}
      {reviewList.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
            {t.questionsWrong}
          </div>
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
