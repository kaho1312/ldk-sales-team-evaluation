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
  cumulativeCorrect: number;
  cumulativeTotal: number;
  cumulativeThreshold: number;
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
  cumulativeCorrect,
  cumulativeTotal,
  cumulativeThreshold,
  onRestart,
}: QuizResultsProps) {
  const t = LANG[lang];

  // Pass/fail is determined entirely by cumulative progress
  const certified = cumulativeCorrect >= cumulativeThreshold;
  const remaining = Math.max(0, cumulativeThreshold - cumulativeCorrect);

  // Session stats
  const sessionCorrect = results.filter((r) => r.isCorrect).length;
  const sessionWrong = results.filter((r) => !r.isCorrect).length;

  const sectionLabel =
    section === "A"
      ? lang === "es" ? "Sección A – Operación" : "Section A – Operations"
      : section === "B"
        ? lang === "es" ? "Sección B – Acordeón" : "Section B – Acordeón"
        : lang === "es" ? "Sección C – Plataformas" : "Section C – Platforms";

  return (
    <div>
      {/* ── CUMULATIVE BLOCK ── */}
      <div
        className={`rounded-xl border p-5 mb-5 ${
          certified
            ? "bg-success/5 border-success/20"
            : "bg-secondary/30 border-border/50"
        }`}
      >
        {/* Icon + fraction */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
              {lang === "es" ? "Total acumulado" : "Cumulative Total"}
            </div>
            <div
              className={`text-[40px] font-extrabold tracking-tighter leading-none ${
                certified ? "text-success" : "text-foreground"
              }`}
            >
              {cumulativeCorrect}
              <span className="text-xl font-bold text-muted-foreground/40">
                /{cumulativeTotal}
              </span>
            </div>
          </div>
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-extrabold shrink-0 ${
              certified
                ? "bg-success/10 border-2 border-success/35 text-success"
                : "bg-secondary border-2 border-border text-muted-foreground"
            }`}
          >
            {certified ? "✓" : "…"}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              certified ? "bg-success" : "bg-gradient-to-r from-primary/60 to-primary"
            }`}
            style={{ width: `${Math.min(100, Math.round((cumulativeCorrect / cumulativeTotal) * 100))}%` }}
          />
        </div>

        {/* Headline + message */}
        <div className={`text-base font-bold mb-1 ${certified ? "text-success" : "text-foreground"}`}>
          {certified ? t.passed : t.failed}
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">
          {certified
            ? t.passMsg
            : lang === "es"
              ? `Te faltan ${remaining} respuesta${remaining === 1 ? "" : "s"} correcta${remaining === 1 ? "" : "s"} para certificarte (mínimo ${cumulativeThreshold}/${cumulativeTotal}).`
              : `You need ${remaining} more correct answer${remaining === 1 ? "" : "s"} to certify (minimum ${cumulativeThreshold}/${cumulativeTotal}).`}
        </div>

        {/* Agent + tier tags */}
        <div className="text-[11px] text-muted-foreground/50 mt-2">
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
      </div>

      {/* Just earned badge */}
      {justEarned && certified && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl py-3 px-4 text-center mb-5">
          <div className="text-lg mb-1">🎉</div>
          <div className="text-sm font-bold text-teal-400">
            {lang === "es"
              ? "¡Felicidades! Ahora eres Junior Sales Agent"
              : "Congratulations! You are now a Junior Sales Agent"}
          </div>
        </div>
      )}

      {/* ── SESSION BLOCK ── */}
      <div className="mb-5">
        <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/50 mb-2">
          {lang === "es" ? `Esta sesión · ${sectionLabel}` : `This session · ${sectionLabel}`}
        </div>

        <div className="flex gap-2.5 mb-4">
          <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
            <div className="text-2xl font-extrabold text-success mb-1">{sessionCorrect}</div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.correct_count}</div>
          </div>
          <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
            <div className="text-2xl font-extrabold text-destructive mb-1">{sessionWrong}</div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.wrong_count}</div>
          </div>
          <div className="flex-1 bg-secondary/40 border border-border rounded-xl p-3.5 text-center">
            <div className="text-2xl font-extrabold text-muted-foreground/50 mb-1">{totalQuestions}</div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{t.total}</div>
          </div>
        </div>

        {/* Wrong questions */}
        {sessionWrong > 0 && (
          <div>
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
      </div>

      {/* 24h retake warning — only shown when not yet certified */}
      {!certified && (
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
