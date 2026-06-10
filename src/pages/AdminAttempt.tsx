import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { adminGetAttemptDetails, adminOverrideAnswer, getActiveConfig, grantCertification } from "@/lib/api";
import type { AttemptWithAnswers, Answer, QuizConfig } from "@/lib/api";
import type { ScoreResult } from "@/lib/scoring";
import { FALLBACK_QUESTIONS } from "@/lib/questions";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TierBadge({ tier }: { tier: string }) {
  const normalized = tier.toLowerCase();
  const styles =
    normalized === "junior"
      ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
      : normalized === "mid-level"
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles}`}>
      {tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "passed"
      ? "bg-success/10 text-success border-success/20"
      : status === "failed"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : "bg-warning/10 text-warning border-warning/20";
  const label =
    status === "passed" ? "Aprobado" : status === "failed" ? "Reprobado" : "En progreso";
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles}`}>
      {label}
    </span>
  );
}

// ── Score summary derived from attempt or override result ─────────────────────

interface ScoreSummaryProps {
  attempt: AttemptWithAnswers;
  overrideResult: ScoreResult | null;
  originalPassed: boolean;
}

function ScoreSummary({ attempt, overrideResult, originalPassed }: ScoreSummaryProps) {
  const scorePercent = overrideResult?.score_percent ?? attempt.score_percent ?? 0;
  const totalCorrect = overrideResult?.total_correct ?? attempt.total_correct ?? 0;
  const totalQuestions = overrideResult?.total_questions ?? attempt.total_questions ?? 0;
  const sectionErrors = overrideResult?.section_errors ?? attempt.section_errors ?? { A: 0, B: 0, C: 0 };
  const passed = overrideResult?.passed ?? (attempt.status === "passed");
  const failReasons = overrideResult?.fail_reasons ?? [];

  const scoreColor = passed ? "text-success" : "text-destructive";

  // Show status change notice only when there's an override result
  const statusChanged = overrideResult !== null && passed !== originalPassed;

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm space-y-4">
      <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
        Resumen de puntaje
      </span>

      <div className="flex items-end gap-4 flex-wrap">
        <div className={`text-5xl font-extrabold tabular-nums ${scoreColor}`}>
          {scorePercent}%
        </div>
        <div className="space-y-1 pb-1">
          <div className="text-sm font-semibold text-foreground">
            {totalCorrect}/{totalQuestions} correctas
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>A: <span className="text-foreground font-semibold">{sectionErrors.A} errores</span></span>
            <span>B: <span className="text-foreground font-semibold">{sectionErrors.B} errores</span></span>
            <span>C: <span className="text-foreground font-semibold">{sectionErrors.C} errores</span></span>
          </div>
        </div>
        <div className="pb-1">
          <StatusBadge status={passed ? "passed" : "failed"} />
        </div>
      </div>

      {failReasons.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 space-y-1">
          <div className="text-[11px] font-bold tracking-wider uppercase text-destructive/70 mb-1">
            Razones de reprobación
          </div>
          {failReasons.map((r, i) => (
            <div key={i} className="text-xs text-destructive/90">{r}</div>
          ))}
        </div>
      )}

      {statusChanged && passed && (
        <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success font-semibold">
          ✓ Con estas correcciones el intento APRUEBA — puedes otorgar la certificación
        </div>
      )}

      {statusChanged && !passed && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 text-sm text-warning font-semibold">
          ⚠ Con estas correcciones el intento ya no aprueba
        </div>
      )}
    </div>
  );
}

// ── Answer card ───────────────────────────────────────────────────────────────

interface AnswerCardProps {
  answer: Answer;
  config: QuizConfig;
  attemptId: string;
  onOverrideApplied: (result: ScoreResult, updatedAnswer: Answer) => void;
}

function AnswerCard({ answer, config, attemptId, onOverrideApplied }: AnswerCardProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [localAnswer, setLocalAnswer] = useState<Answer>(answer);
  const [applying, setApplying] = useState(false);

  const borderColor =
    localAnswer.final_grade === true
      ? "border-success/40"
      : localAnswer.final_grade === false
        ? "border-destructive/40"
        : "border-border/50";

  const handleOverride = async (value: boolean | null) => {
    setApplying(true);
    try {
      const result = await adminOverrideAnswer(localAnswer.id, value, attemptId, config);
      const updated: Answer = {
        ...localAnswer,
        admin_override: value,
        final_grade: value !== null ? value : localAnswer.ai_grade,
      };
      setLocalAnswer(updated);
      onOverrideApplied(result, updated);
      toast.success(
        value === null
          ? "Anulación eliminada"
          : value
            ? "Marcado como correcto"
            : "Marcado como incorrecto",
      );
    } catch {
      toast.error("Error al aplicar la anulación");
    } finally {
      setApplying(false);
    }
  };

  // Question text isn't stored on the Answer row — look it up by id from the bundled bank.
  const questionText = FALLBACK_QUESTIONS.find((q) => q.id === answer.question_id)?.question;

  // Section badge color
  const sectionBadgeStyle =
    answer.section === "A"
      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
      : answer.section === "B"
        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
        : answer.section === "C"
          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
          : "bg-secondary/40 text-muted-foreground border-border/50";

  return (
    <div className={`bg-card/50 border rounded-2xl p-4 backdrop-blur-sm space-y-3 ${borderColor}`}>
      {/* Question ID + section */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-foreground font-mono">{answer.question_id}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sectionBadgeStyle}`}>
          Sección {answer.section}
        </span>
        {localAnswer.final_grade === true && (
          <span className="text-[10px] font-bold text-success ml-auto">✓ Correcto</span>
        )}
        {localAnswer.final_grade === false && (
          <span className="text-[10px] font-bold text-destructive ml-auto">✗ Incorrecto</span>
        )}
        {localAnswer.final_grade === null && (
          <span className="text-[10px] font-bold text-muted-foreground ml-auto">Sin calificación</span>
        )}
      </div>

      {/* Question text — full, untruncated (omitted if the id isn't in the bundled bank) */}
      {questionText && (
        <div className="text-sm text-foreground/90 leading-relaxed">{questionText}</div>
      )}

      {/* User answer */}
      <div>
        <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-1">
          Respuesta del agente
        </div>
        <div className="text-sm text-foreground bg-secondary/30 border border-border/40 rounded-xl px-3 py-2.5 whitespace-pre-wrap">
          {answer.user_answer || <span className="text-muted-foreground italic">Sin respuesta</span>}
        </div>
      </div>

      {/* AI grade */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
          Evaluación IA:
        </span>
        {answer.ai_grade === true && (
          <span className="text-xs font-bold text-success">✓ Correcto</span>
        )}
        {answer.ai_grade === false && (
          <span className="text-xs font-bold text-destructive">✗ Incorrecto</span>
        )}
        {answer.ai_grade === null && (
          <span className="text-xs text-muted-foreground italic">No evaluada</span>
        )}
      </div>

      {/* AI reasoning — collapsible */}
      {answer.ai_reasoning && (
        <div>
          <button
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowReasoning((v) => !v)}
          >
            Ver evaluación IA {showReasoning ? "▴" : "▾"}
          </button>
          {showReasoning && (
            <div className="mt-2 text-xs text-muted-foreground bg-secondary/20 border border-border/30 rounded-xl px-3 py-2.5 leading-relaxed">
              {answer.ai_reasoning}
            </div>
          )}
        </div>
      )}

      {/* Admin override controls */}
      <div className="pt-1 border-t border-border/30">
        {localAnswer.admin_override === null || localAnswer.admin_override === undefined ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              Anulación admin:
            </span>
            <button
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-success/10 border border-success/20 text-success hover:bg-success/20 transition-colors disabled:opacity-50"
              disabled={applying}
              onClick={() => handleOverride(true)}
            >
              ✓ Marcar correcto
            </button>
            <button
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
              disabled={applying}
              onClick={() => handleOverride(false)}
            >
              ✗ Marcar incorrecto
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              Anulación Admin:
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                localAnswer.admin_override
                  ? "bg-success/10 border-success/20 text-success"
                  : "bg-destructive/10 border-destructive/20 text-destructive"
              }`}
            >
              {localAnswer.admin_override ? "Correcto" : "Incorrecto"}
            </span>
            <button
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-secondary/40 border border-border/50 text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition-colors disabled:opacity-50"
              disabled={applying}
              onClick={() => handleOverride(null)}
            >
              Quitar anulación
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAttempt() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState<AttemptWithAnswers | null>(null);
  const [config, setConfig] = useState<QuizConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideResult, setOverrideResult] = useState<ScoreResult | null>(null);
  const [originalPassed, setOriginalPassed] = useState(false);
  const [granting, setGranting] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (!id) return;
    adminGetAttemptDetails(id)
      .then(async (data) => {
        if (!data) return;
        setAttempt(data);
        setOriginalPassed(data.status === "passed");
        const cfg = await getActiveConfig(data.certification_tier);
        setConfig(cfg);
      })
      .catch(() => toast.error("Error al cargar el intento"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleOverrideApplied = (result: ScoreResult, updatedAnswer: Answer) => {
    setOverrideResult(result);
    setAttempt((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: prev.answers.map((a) => (a.id === updatedAnswer.id ? updatedAnswer : a)),
        status: result.passed ? "passed" : "failed",
        score_percent: result.score_percent,
        total_correct: result.total_correct,
        section_errors: result.section_errors,
      };
    });
  };

  const handleGrantCertification = async () => {
    if (!attempt || !user) return;
    setGranting(true);
    try {
      await grantCertification(
        attempt.user_id,
        attempt.certification_tier,
        attempt.id,
        user.email,
      );
      setGranted(true);
      toast.success(`Certificación ${attempt.certification_tier} otorgada correctamente`);
    } catch {
      toast.error("Error al otorgar la certificación");
    } finally {
      setGranting(false);
    }
  };

  // Determine current pass status (considering override)
  const currentlyPassed = overrideResult?.passed ?? (attempt?.status === "passed");

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Cargando intento...</div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-muted-foreground text-sm">No se encontró el intento.</div>
          <Link
            to="/admin"
            className="text-sm font-semibold text-primary hover:text-primary/70 transition-colors"
          >
            ← Volver al Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="font-extrabold text-foreground tracking-tight text-lg">LDK Admin</span>
          <Link
            to="/admin"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Volver al Admin
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Header card ── */}
        <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          {/* User + tier + attempt number */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                Detalle de intento
              </span>
              <h1 className="text-xl font-extrabold text-foreground tracking-tight mt-0.5">
                {attempt.user.full_name}
              </h1>
              <div className="text-sm text-muted-foreground">{attempt.user.email}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <TierBadge tier={attempt.certification_tier} />
              <span className="text-[11px] font-bold text-muted-foreground">
                Intento #{attempt.attempt_number}
              </span>
              <StatusBadge status={attempt.status} />
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px]">Iniciado</span>
              <div className="text-foreground mt-0.5">{fmtDate(attempt.started_at)}</div>
            </div>
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px]">Completado</span>
              <div className="text-foreground mt-0.5">{fmtDate(attempt.completed_at)}</div>
            </div>
          </div>

          {/* Grant certification button */}
          {currentlyPassed && !granted && (
            <div className="pt-2">
              <button
                className="bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-2.5 px-4 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleGrantCertification}
                disabled={granting}
              >
                {granting ? "Otorgando..." : "Otorgar Certificación"}
              </button>
            </div>
          )}

          {granted && (
            <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success font-semibold">
              ✓ Certificación otorgada correctamente
            </div>
          )}
        </div>

        {/* ── Score summary ── */}
        <ScoreSummary
          attempt={attempt}
          overrideResult={overrideResult}
          originalPassed={originalPassed}
        />

        {/* ── Answer list ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              Respuestas ({attempt.answers.length})
            </span>
          </div>

          {attempt.answers.length === 0 ? (
            <div className="bg-card/50 border border-border/50 rounded-2xl p-8 backdrop-blur-sm text-center text-muted-foreground text-sm">
              No hay respuestas registradas para este intento.
            </div>
          ) : (
            <div className="space-y-3">
              {attempt.answers.map((answer) => (
                <AnswerCard
                  key={answer.id}
                  answer={answer}
                  config={
                    config ?? {
                      id: "",
                      certification_tier: attempt.certification_tier,
                      total_questions: attempt.total_questions ?? 55,
                      section_count: 3,
                      passing_threshold: 0.9,
                      questions_source_url: null,
                      is_active: true,
                      updated_at: "",
                    }
                  }
                  attemptId={attempt.id}
                  onOverrideApplied={handleOverrideApplied}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
