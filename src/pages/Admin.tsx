import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  adminGetAllUsers,
  adminGetAllAttempts,
  adminSetUserAdmin,
  adminDeleteUser,
  adminSendPasswordReset,
  getQuizConfigs,
  updateQuizConfig,
  exportAttemptsToCSV,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { AdminUserRow, QuizConfig, QuizAttempt } from "@/lib/api";
import { toast } from "sonner";

// ── Helper: tier badge ────────────────────────────────────────────────────────
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

// ── Helper: status badge ──────────────────────────────────────────────────────
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

// ── Helper: format date ───────────────────────────────────────────────────────
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

// ── Tab 1: Agentes ────────────────────────────────────────────────────────────
function AgentesTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState<string | null>(null);

  const handleToggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    setTogglingAdmin(userId);
    try {
      await adminSetUserAdmin(userId, !currentIsAdmin);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: !currentIsAdmin } : u)),
      );
      toast.success(!currentIsAdmin ? "Acceso admin otorgado" : "Acceso admin removido");
    } catch {
      toast.error("Error al cambiar acceso admin");
    } finally {
      setTogglingAdmin(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setDeleting(userId);
    try {
      await adminDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("Usuario eliminado. El correo queda libre para registrarse de nuevo.");
    } catch {
      toast.error("Error al eliminar el usuario");
    } finally {
      setDeleting(null);
      setConfirmingDelete(null);
    }
  };

  const handleSendReset = async (userId: string, email: string) => {
    setSendingReset(userId);
    try {
      await adminSendPasswordReset(userId);
      toast.success(`Correo de restablecimiento enviado a ${email}`);
    } catch {
      toast.error("Error al enviar el correo de restablecimiento");
    } finally {
      setSendingReset(null);
    }
  };

  useEffect(() => {
    adminGetAllUsers()
      .then(setUsers)
      .catch(() => toast.error("Error al cargar usuarios"))
      .finally(() => setLoading(false));
  }, []);

  const toggleRow = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando usuarios...
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No hay usuarios registrados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="hidden md:grid grid-cols-[2fr_2fr_2fr_2fr_1fr_1fr] gap-3 px-4 py-2">
        {["Nombre", "Correo", "Último acceso", "Certificaciones", "Intentos", "Mejor puntaje"].map((h) => (
          <span key={h} className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            {h}
          </span>
        ))}
      </div>

      {users.map((user) => {
        const isOpen = expanded.has(user.id);
        const attemptCount = user.attempts.length;
        const bestScore = user.attempts.reduce<number | null>((best, a) => {
          if (a.score_percent == null) return best;
          return best == null || a.score_percent > best ? a.score_percent : best;
        }, null);

        return (
          <div
            key={user.id}
            className="bg-card/50 border border-border/50 rounded-2xl overflow-hidden backdrop-blur-sm"
          >
            {/* Main row — clickable */}
            <button
              className="w-full text-left px-4 py-4 hover:bg-secondary/20 transition-colors"
              onClick={() => toggleRow(user.id)}
            >
              <div className="md:grid grid-cols-[2fr_2fr_2fr_2fr_1fr_1fr] gap-3 items-center flex flex-col md:flex-row">
                {/* Nombre */}
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="font-semibold text-sm text-foreground leading-tight">{user.full_name}</div>
                    {user.is_admin && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                        Admin
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground md:hidden">{user.email}</div>
                </div>
                {/* Correo */}
                <div className="hidden md:block text-sm text-muted-foreground truncate">{user.email}</div>
                {/* Último acceso */}
                <div className="text-xs text-muted-foreground">{fmtDate(user.last_login)}</div>
                {/* Certificaciones */}
                <div className="flex flex-wrap gap-1">
                  {user.certifications.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground/40">—</span>
                  ) : (
                    user.certifications.map((c) => (
                      <TierBadge key={c.certification_tier} tier={c.certification_tier} />
                    ))
                  )}
                </div>
                {/* Intentos */}
                <div className="text-sm font-semibold text-foreground text-center">{attemptCount}</div>
                {/* Mejor puntaje */}
                <div className="text-sm font-semibold text-foreground text-center">
                  {bestScore != null ? `${bestScore}%` : "—"}
                </div>
              </div>

              <div className="flex justify-end mt-1">
                <span className="text-[11px] text-muted-foreground/50">
                  {isOpen ? "▲ Ocultar intentos" : "▼ Ver intentos"}
                </span>
              </div>
            </button>

            {/* Expanded: attempt list + admin toggle */}
            {isOpen && (
              <div className="border-t border-border/50 bg-secondary/10 px-4 py-3 space-y-2">
                {user.attempts.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">Sin intentos registrados.</div>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 px-2 pb-1">
                      {["Intento #", "Nivel", "Estado", "Puntaje", ""].map((h, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/60"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    {user.attempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-center bg-card/30 rounded-xl px-3 py-2.5"
                      >
                        <span className="text-xs font-semibold text-foreground">
                          #{attempt.attempt_number}
                        </span>
                        <TierBadge tier={attempt.certification_tier} />
                        <StatusBadge status={attempt.status} />
                        <span className="text-xs text-foreground">
                          {attempt.score_percent != null ? `${attempt.score_percent}%` : "—"}
                          {attempt.total_correct != null && attempt.total_questions != null && (
                            <span className="text-muted-foreground ml-1">
                              ({attempt.total_correct}/{attempt.total_questions})
                            </span>
                          )}
                        </span>
                        <Link
                          to={`/admin/attempt/${attempt.id}`}
                          className="text-[11px] font-bold text-primary hover:text-primary/70 transition-colors whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver detalle →
                        </Link>
                      </div>
                    ))}
                  </>
                )}
                {/* Admin access toggle + delete */}
                <div className="pt-2 border-t border-border/30 flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                    Acceso Admin:
                  </span>
                  <button
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                      user.is_admin
                        ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                        : "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20"
                    }`}
                    disabled={togglingAdmin === user.id}
                    onClick={(e) => { e.stopPropagation(); handleToggleAdmin(user.id, user.is_admin); }}
                  >
                    {togglingAdmin === user.id
                      ? "..."
                      : user.is_admin
                        ? "Quitar acceso admin"
                        : "Dar acceso admin"}
                  </button>

                  {/* Send password-reset email */}
                  <button
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-primary/20 text-primary/90 hover:bg-primary/10 transition-colors disabled:opacity-50"
                    disabled={sendingReset === user.id}
                    onClick={(e) => { e.stopPropagation(); handleSendReset(user.id, user.email); }}
                  >
                    {sendingReset === user.id ? "Enviando..." : "Enviar restablecimiento"}
                  </button>

                  {/* Delete user — hidden for your own account (backend also blocks self-deletion) */}
                  {currentUser?.id !== user.id && (
                    <div className="ml-auto flex items-center gap-2">
                      {confirmingDelete === user.id ? (
                        <>
                          <span className="text-[11px] text-destructive font-semibold">
                            ¿Eliminar a {user.full_name}? Se borran sus intentos y certificaciones.
                          </span>
                          <button
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-destructive/15 border-destructive/30 text-destructive hover:bg-destructive/25 transition-colors disabled:opacity-50"
                            disabled={deleting === user.id}
                            onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }}
                          >
                            {deleting === user.id ? "Eliminando..." : "Sí, eliminar"}
                          </button>
                          <button
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null); }}
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-destructive/20 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          onClick={(e) => { e.stopPropagation(); setConfirmingDelete(user.id); }}
                        >
                          Eliminar usuario
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab 2: Exportar CSV ───────────────────────────────────────────────────────
function ExportarCSVTab() {
  const [loading, setLoading] = useState(false);
  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const attempts = await adminGetAllAttempts();
      const csv = exportAttemptsToCSV(attempts);

      // Trigger download
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ldk_intentos_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportedCount(attempts.length);
      toast.success(`CSV exportado con ${attempts.length} intentos`);
    } catch {
      toast.error("Error al exportar el CSV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm space-y-4">
        <div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Exportar datos
          </span>
          <h2 className="text-base font-bold text-foreground mt-1">Todos los intentos de quiz</h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Descarga un archivo CSV con todos los intentos registrados: nombre, correo, nivel, puntaje,
            errores por sección y fechas.
          </p>
        </div>

        <button
          className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-2.5 px-4 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleExport}
          disabled={loading}
        >
          {loading ? "Exportando..." : "Exportar todos los intentos (CSV)"}
        </button>

        {exportedCount != null && (
          <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 text-sm text-success font-semibold">
            Exportados {exportedCount} intentos correctamente.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Configuración ──────────────────────────────────────────────────────
function ConfigCard({ config, onSaved }: { config: QuizConfig; onSaved: (updated: QuizConfig) => void }) {
  const [totalQuestions, setTotalQuestions] = useState(config.total_questions);
  const [questionsSourceUrl, setQuestionsSourceUrl] = useState(config.questions_source_url ?? "");
  const [isActive, setIsActive] = useState(config.is_active);
  // Editable pass %. Note passing_threshold arrives as a DECIMAL string from MySQL,
  // so coerce with Number() before scaling.
  const [passPercent, setPassPercent] = useState(Math.round(Number(config.passing_threshold) * 100));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    // ALWAYS send passing_threshold: the Lambda PUT overwrites all columns, so
    // omitting it (as before) wiped the threshold to 0 — an accidental "everyone
    // passes". Clamp to a sane 1–100% range.
    const threshold = Math.min(100, Math.max(1, passPercent)) / 100;
    try {
      await updateQuizConfig(config.id, {
        total_questions: totalQuestions,
        passing_threshold: threshold,
        questions_source_url: questionsSourceUrl || null,
        is_active: isActive,
      });
      onSaved({
        ...config,
        total_questions: totalQuestions,
        passing_threshold: threshold,
        questions_source_url: questionsSourceUrl || null,
        is_active: isActive,
      });
      toast.success(`Configuración de ${config.certification_tier} guardada`);
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const tier = config.certification_tier;

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TierBadge tier={tier} />
          <span className="font-bold text-foreground capitalize">{tier}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              isActive
                ? "bg-success/10 text-success border-success/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
          <button
            className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-2.5 py-1"
            onClick={() => setIsActive((v) => !v)}
          >
            {isActive ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>

      {!isActive && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-2.5 text-xs text-warning font-semibold">
          Este nivel esta inactivo. Los agentes no podran iniciar examenes de este nivel.
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground block mb-1.5">
            Total de preguntas
          </label>
          <input
            type="number"
            min={1}
            max={200}
            className="bg-secondary/50 border border-border rounded-xl text-foreground text-sm py-2 px-3 outline-none focus:border-primary/40 transition-colors w-32"
            value={totalQuestions}
            onChange={(e) => setTotalQuestions(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground block mb-1.5">
            Umbral de aprobacion (%)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            className="bg-secondary/50 border border-border rounded-xl text-foreground text-sm py-2 px-3 outline-none focus:border-primary/40 transition-colors w-32"
            value={passPercent}
            onChange={(e) => setPassPercent(Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground block mb-1.5">
            URL de preguntas (Google Sheet / CSV)
          </label>
          <input
            type="text"
            className="w-full bg-secondary/50 border border-border rounded-xl text-foreground text-sm py-2 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
            placeholder="https://..."
            value={questionsSourceUrl}
            onChange={(e) => setQuestionsSourceUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Save */}
      <button
        className="bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-sm font-bold py-2.5 px-4 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}

function ConfiguracionTab() {
  const [configs, setConfigs] = useState<QuizConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuizConfigs()
      .then(setConfigs)
      .catch(() => toast.error("Error al cargar configuraciones"))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (updated: QuizConfig) => {
    setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Cargando configuraciones...
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        No hay configuraciones disponibles.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {configs.map((cfg) => (
        <ConfigCard key={cfg.id} config={cfg} onSaved={handleSaved} />
      ))}
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────
type Tab = "agentes" | "csv" | "config";

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>("agentes");

  const tabs: { id: Tab; label: string }[] = [
    { id: "agentes", label: "Agentes" },
    { id: "csv", label: "Exportar CSV" },
    { id: "config", label: "Configuracion" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      {/* Top bar */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="font-extrabold text-foreground tracking-tight text-lg">LDK Admin</span>
          <Link
            to="/"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Quiz
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">Panel de administracion</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestion de agentes, intentos y configuracion del quiz
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${
                activeTab === tab.id
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "text-muted-foreground border border-transparent hover:text-foreground/70"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "agentes" && <AgentesTab />}
        {activeTab === "csv" && <ExportarCSVTab />}
        {activeTab === "config" && <ConfiguracionTab />}
      </div>
    </div>
  );
}
