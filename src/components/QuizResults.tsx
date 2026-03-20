import { LANG, Lang } from "@/lib/i18n";

interface QuizResult {
  id: string;
  question: string;
  isCorrect: boolean;
}

interface QuizResultsProps {
  lang: Lang;
  agentName: string;
  earnedTier: string | null;
  section: string;
  results: QuizResult[];
  totalQuestions: number;
  justEarned: boolean;
  onRestart: () => void;
}

export function QuizResults({
  lang,
  agentName,
  earnedTier,
  section,
  results,
  totalQuestions,
  justEarned,
  onRestart,
}: QuizResultsProps) {
  const t = LANG[lang];
  const correctCount = results.filter((r) => r.isCorrect).length;
  const wrongCount = results.filter((r) => !r.isCorrect).length;
  const finalScore = Math.round((correctCount / totalQuestions) * 100);
  const passed = finalScore >= 90;

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
          passed
            ? "bg-success/10 border-2 border-success/35 text-success"
            : "bg-destructive/10 border-2 border-destructive/30 text-destructive"
        }`}
      >
        {passed ? "✓" : "✗"}
      </div>

      <div
        className={`text-[52px] font-extrabold tracking-tighter text-center leading-none mb-1 ${
          passed ? "text-success" : "text-destructive"
        }`}
      >
        {finalScore}%
      </div>

      <div className="text-xs text-muted-foreground text-center mb-5">{t.score}</div>

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

      <div className="text-xl font-bold text-foreground text-center mb-1.5">{passed ? t.passed : t.failed}</div>

      <div className="text-sm text-muted-foreground text-center leading-relaxed mb-6">
        {passed ? t.passMsg : t.failMsg}
      </div>

      {/* Just earned Junior badge */}
      {justEarned && passed && (
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
          <div className="text-2xl font-extrabold text-success mb-1">{correctCount}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.correct_count}</div>
        </div>
        <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
          <div className="text-2xl font-extrabold text-destructive mb-1">{wrongCount}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.wrong_count}</div>
        </div>
        <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
          <div className="text-2xl font-extrabold text-muted-foreground/50 mb-1">{totalQuestions}</div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.total}</div>
        </div>
      </div>

      {/* Wrong questions list */}
      {wrongCount > 0 && (
        <div className="mb-5">
          <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2">
            {t.questionsWrong}
          </div>
          {results
            .filter((r) => !r.isCorrect)
            .map((r) => (
              <div
                key={r.id}
                className="bg-destructive/5 border border-destructive/10 rounded-lg py-2.5 px-3 text-sm text-muted-foreground leading-snug mb-1.5"
              >
                {r.id} · {r.question.length > 68 ? r.question.slice(0, 68) + "…" : r.question}
              </div>
            ))}
        </div>
      )}

      {/* Retake warning */}
      {!passed && (
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
