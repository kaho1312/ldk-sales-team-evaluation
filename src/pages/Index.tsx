import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { QuizHeader } from "@/components/QuizHeader";
import { QuizQuestionView } from "@/components/QuizQuestion";
import { QuizResults } from "@/components/QuizResults";
import { Leaderboard } from "@/components/Leaderboard";
import { LANG, Lang } from "@/lib/i18n";
import {
  QuizQuestion,
  FALLBACK_QUESTIONS,
  Section,
  getByTierAndSection,
  getSectionCounts,
} from "@/lib/questions";
import { saveAnswer, getAgentProgress, getProgressPercent } from "@/lib/progress";
import { logout } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import {
  startAttempt,
  saveAnswerToAttempt,
  completeAttempt,
  grantCertification,
  getUserCertifications,
  getUserProgress,
  getActiveConfig,
  getCompletedSections,
} from "@/lib/api";
import { CertificationBadges } from "@/components/CertificationBadges";
import { toast } from "sonner";

// ── localStorage keys (kept for break/resume and local cache) ─────────────────
const EARNED_TIER_KEY = (email: string, tier: string) => `ldk_earned_tier_${tier}_${email}`;
const BREAK_KEY = (email: string) => `ldk_break_${email}`;
const SHEET_URL_KEY = "ldk_quiz_sheet_url";
const ALL_TIERS = ["Junior", "Mid-Level", "Senior"] as const;

function getEarnedTiersLocal(email: string): Set<string> {
  const earned = new Set<string>();
  for (const tier of ALL_TIERS) {
    if (localStorage.getItem(EARNED_TIER_KEY(email, tier))) earned.add(tier);
  }
  const legacy = localStorage.getItem(`ldk_earned_tier_${email}`);
  if (legacy) earned.add(legacy);
  return earned;
}

function saveEarnedTierLocal(email: string, tier: string) {
  localStorage.setItem(EARNED_TIER_KEY(email, tier), "1");
}

// Map Supabase tier strings to display names
function tierKey(dbTier: string): string {
  if (dbTier === "junior") return "Junior";
  if (dbTier === "mid-level") return "Mid-Level";
  return "Senior";
}

interface SavedBreak {
  agentEmail: string;
  section: Section;
  currentQuestionIndex: number;
  answers: { id: string; question: string; isCorrect: boolean }[];
  score: number;
  savedAt: string;
  totalQuestions: number;
  testMode: boolean;
}

function getSavedBreak(email: string): SavedBreak | null {
  try {
    const raw = localStorage.getItem(BREAK_KEY(email));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSavedBreak(email: string) {
  localStorage.removeItem(BREAK_KEY(email));
}

function TierBadge({ tier }: { tier: string }) {
  const styles =
    tier === "Junior"
      ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
      : tier === "Mid-Level"
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return (
    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${styles}`}>
      {tier} Agent
    </span>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // user is always defined here (RequireAuth ensures it)
  const agentKey = user?.email ?? "";
  const displayName = user?.fullName ?? "";

  const [lang, setLang] = useState<Lang>("es");
  const [screen, setScreen] = useState<"start" | "section" | "quiz" | "results" | "leaderboard">("start");

  // Certifications — initialized from localStorage cache, refreshed from Supabase
  const [earnedTiers, setEarnedTiers] = useState<Set<string>>(() => getEarnedTiersLocal(agentKey));
  const [justEarned, setJustEarned] = useState<string | null>(null);

  // Section / quiz state
  const [selectedSection, setSelectedSection] = useState<Section>("A");
  const [testMode, setTestMode] = useState(false);
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [sessionResults, setSessionResults] = useState<{ id: string; question: string; isCorrect: boolean; feedback: string; correctAnswer: string }[]>([]);

  // Supabase attempt tracking
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [quizConfig, setQuizConfig] = useState<{ total_questions: number; passing_threshold: number }>({
    total_questions: 55,
    passing_threshold: 0.9,
  });

  // Supabase progress (async, replaces localStorage progress bar)
  const [progressData, setProgressData] = useState<{ correct: number; total: number; certified: boolean } | null>(null);

  // Local progress (fast, shown while Supabase loads)
  const localAgentProgress = getAgentProgress(agentKey);
  const localProgressPercent = getProgressPercent(agentKey);

  const progressPercent = progressData
    ? Math.round((progressData.correct / progressData.total) * 100)
    : localProgressPercent;

  const certifiedOverall = progressData?.certified ?? localAgentProgress.certified;

  // Questions
  const [allQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");
  const [showAdmin, setShowAdmin] = useState(false);
  const [savedBreak, setSavedBreak] = useState<SavedBreak | null>(() => getSavedBreak(agentKey));

  // Migration banner
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  const t = LANG[lang];

  const sectionQuestions = useMemo(
    () => getByTierAndSection(allQuestions, "Junior", selectedSection),
    [allQuestions, selectedSection],
  );
  const sessionQuestions = useMemo(
    () => (testMode ? sectionQuestions.slice(0, 3) : sectionQuestions),
    [sectionQuestions, testMode],
  );
  const sectionCounts = useMemo(() => getSectionCounts(allQuestions, "Junior"), [allQuestions]);
  const q = sessionQuestions[currentQ];

  // ── Load Supabase data on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Load certifications from Supabase and sync to local cache
    getUserCertifications(user.id).then((certs) => {
      const fromDb = new Set(certs.map((c) => tierKey(c.certification_tier)));
      // Merge with local (local may have data not yet in DB during migration window)
      const merged = new Set([...getEarnedTiersLocal(agentKey), ...fromDb]);
      setEarnedTiers(merged);
      // Sync to localStorage
      for (const tier of fromDb) {
        saveEarnedTierLocal(agentKey, tier);
      }
    });

    // Load progress from Supabase
    getUserProgress(user.id, "junior").then(setProgressData);

    // Load completed sections
    getCompletedSections(user.id, "junior").then(setCompletedSections);

    // Load quiz config
    getActiveConfig("junior").then((config) => {
      if (config) {
        setQuizConfig({
          total_questions: config.total_questions,
          passing_threshold: config.passing_threshold,
        });
      }
    });

    // Check for localStorage migration data
    const hasOldData = Object.keys(localStorage).some(
      (k) => k.startsWith("ldk_agent_progress"),
    );
    if (hasOldData) setShowMigrationBanner(true);
  }, [user?.id]);

  // Refresh progress and completed sections after returning to start screen
  useEffect(() => {
    if (screen === "start" && user) {
      getUserProgress(user.id, "junior").then(setProgressData);
      getCompletedSections(user.id, "junior").then(setCompletedSections);
    }
  }, [screen, user?.id]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // ── Migration: dismiss or clear old localStorage data ───────────────────
  const handleDismissMigration = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("ldk_agent_progress") || k.startsWith("ldk_users"))
      .forEach((k) => localStorage.removeItem(k));
    setShowMigrationBanner(false);
    toast.success(lang === "es" ? "Datos locales eliminados." : "Local data cleared.");
  };

  // ── Resume from break ────────────────────────────────────────────────────
  const handleResume = () => {
    if (!savedBreak) return;
    setSelectedSection(savedBreak.section);
    setCurrentQ(savedBreak.currentQuestionIndex);
    setSessionResults(savedBreak.answers);
    setTestMode(savedBreak.testMode ?? false);
    resetGrading();
    clearSavedBreak(agentKey);
    setSavedBreak(null);
    setScreen("quiz");
  };

  const handleDiscardBreak = () => {
    clearSavedBreak(agentKey);
    setSavedBreak(null);
  };

  // ── Take a break ─────────────────────────────────────────────────────────
  const handleBreak = () => {
    const breakData: SavedBreak = {
      agentEmail: agentKey,
      section: selectedSection,
      currentQuestionIndex: currentQ,
      answers: sessionResults,
      score: sessionResults.filter((r) => r.isCorrect).length,
      savedAt: new Date().toISOString(),
      totalQuestions: sessionQuestions.length,
      testMode,
    };
    localStorage.setItem(BREAK_KEY(agentKey), JSON.stringify(breakData));
    setSavedBreak(breakData);
    toast.success(t.breakSaved);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setScreen("start");
  };

  // ── Section selection → start quiz ───────────────────────────────────────
  const handleSectionStart = (section: Section, isTestMode = false) => {
    setSelectedSection(section);
    setTestMode(isTestMode);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setScreen("quiz"); // switch immediately — don't wait for Supabase

    // Start a Supabase attempt in the background (non-blocking)
    if (user) {
      startAttempt(user.id, "junior")
        .then((attemptId) => setCurrentAttemptId(attemptId))
        .catch(() => setCurrentAttemptId(null));
    }
  };

  const resetGrading = () => {
    setGrading(false);
    setGraded(false);
    setIsCorrect(null);
    setFeedback("");
    setCorrectAnswer("");
  };

  // ── Submit answer ─────────────────────────────────────────────────────────
  const handleSubmitAnswer = async (answer: string) => {
    if (!q) return;
    setGrading(true);

    const payload = {
      question: q.question,
      answer,
      modelAnswer: q.modelAnswer,
      section: q.section,
    };

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/grade-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      const correct = !!data.passed;

      setIsCorrect(correct);
      const rawFeedback = data.feedback || "";
      const personalizedFeedback = rawFeedback
        .replace(/\bEl agente\b/g, "Tu respuesta")
        .replace(/\bel agente\b/g, "tu respuesta")
        .replace(/\bThe agent\b/g, "Your answer")
        .replace(/\bthe agent\b/g, "your answer");
      setFeedback(personalizedFeedback);
      setCorrectAnswer(!correct && data.correct_answer ? data.correct_answer : "");
      setGraded(true);
      setGrading(false);

      // Write to localStorage (local progress bar cache)
      saveAnswer(agentKey, q.id, correct);

      // Write to Supabase (authoritative record)
      if (currentAttemptId) {
        saveAnswerToAttempt(
          currentAttemptId,
          q.id,
          q.section,
          answer,
          correct,
          personalizedFeedback,
        ).catch(() => {}); // non-blocking
      }

      const storedCorrectAnswer = !correct && data.correct_answer ? data.correct_answer : "";
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: correct, feedback: personalizedFeedback, correctAnswer: storedCorrectAnswer }]);
    } catch {
      setIsCorrect(false);
      const errorFeedback = lang === "es"
        ? "Error al conectar con el servidor de evaluación."
        : "Error connecting to grading server.";
      setFeedback(errorFeedback);
      setCorrectAnswer("");
      setGraded(true);
      setGrading(false);
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: false, feedback: errorFeedback, correctAnswer: "" }]);
    }
  };

  // ── Next question or finish ───────────────────────────────────────────────
  const handleNext = async () => {
    if (currentQ + 1 >= sessionQuestions.length) {
      const activeTier = "Junior";

      if (currentAttemptId && user) {
        try {
          const result = await completeAttempt(currentAttemptId, quizConfig);
          if (result.passed && !earnedTiers.has(activeTier)) {
            await grantCertification(user.id, "junior", currentAttemptId);
            saveEarnedTierLocal(agentKey, activeTier);
            setEarnedTiers((prev) => new Set([...prev, activeTier]));
            setJustEarned(activeTier);
          }
        } catch {
          // Fall back to local check if Supabase fails
          const latestProgress = getAgentProgress(agentKey);
          if (latestProgress.certified && !earnedTiers.has(activeTier)) {
            saveEarnedTierLocal(agentKey, activeTier);
            setEarnedTiers((prev) => new Set([...prev, activeTier]));
            setJustEarned(activeTier);
          }
        }
      } else {
        // No Supabase attempt — use local check
        const latestProgress = getAgentProgress(agentKey);
        if (latestProgress.certified && !earnedTiers.has(activeTier)) {
          saveEarnedTierLocal(agentKey, activeTier);
          setEarnedTiers((prev) => new Set([...prev, activeTier]));
          setJustEarned(activeTier);
        }
      }

      clearSavedBreak(agentKey);
      setScreen("results");
      return;
    }
    setCurrentQ((p) => p + 1);
    resetGrading();
  };

  // ── Restart ───────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setJustEarned(null);
    setTestMode(false);
    setCurrentAttemptId(null);
    setSavedBreak(getSavedBreak(agentKey));
    setScreen("start");
  };

  // Supabase progress for the results screen (reload after attempt)
  const liveCorrect = progressData?.correct ?? (getAgentProgress(agentKey).correct.length);
  const liveTotal = progressData?.total ?? 55;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {/* ── Title + tabs (start / leaderboard) ── */}
        {(screen === "start" || screen === "leaderboard" || screen === "section") && (
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-[27px] font-extrabold text-foreground tracking-tight mb-1.5">
                  {t.title}
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.startDesc}</p>
              </div>
              <div className="flex items-center gap-3 mt-1 shrink-0 ml-4">
                {user?.isAdmin && (
                  <Link
                    to="/admin"
                    className="text-[11px] font-bold tracking-wider uppercase text-primary/60 hover:text-primary transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/40 hover:text-destructive/60 transition-colors"
                >
                  {lang === "es" ? "Salir" : "Logout"}
                </button>
              </div>
            </div>
          </div>
        )}

        {(screen === "start" || screen === "leaderboard" || screen === "section") && (
          <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5 mb-6">
            <button
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                screen !== "leaderboard"
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "text-muted-foreground border border-transparent hover:text-foreground/60"
              }`}
              onClick={() => setScreen("start")}
            >
              Quiz
            </button>
            <button
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                screen === "leaderboard"
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "text-muted-foreground border border-transparent hover:text-foreground/60"
              }`}
              onClick={() => setScreen("leaderboard")}
            >
              {lang === "es" ? "Clasificación" : "Leaderboard"}
            </button>
          </div>
        )}

        {screen === "leaderboard" && <Leaderboard lang={lang} />}

        {/* ── START SCREEN ── */}
        {screen === "start" && (
          <div>
            {/* Migration banner */}
            {showMigrationBanner && (
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-3.5 mb-4">
                <div className="text-xs font-bold text-warning mb-1">
                  {lang === "es" ? "Datos locales detectados" : "Local data detected"}
                </div>
                <div className="text-[11px] text-muted-foreground mb-3">
                  {lang === "es"
                    ? "Tu historial anterior estaba guardado en este dispositivo. Ahora los datos se guardan en la nube automáticamente."
                    : "Your previous history was stored on this device. Data is now saved to the cloud automatically."}
                </div>
                <button
                  onClick={handleDismissMigration}
                  className="text-[11px] font-bold text-warning/80 hover:text-warning transition-colors"
                >
                  {lang === "es" ? "Limpiar datos locales" : "Clear local data"}
                </button>
              </div>
            )}

            {/* User greeting + certification badges */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                    {lang === "es" ? "Bienvenida" : "Welcome"}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-base font-bold text-foreground">{displayName}</span>
                    {[...earnedTiers].map((tier) => <TierBadge key={tier} tier={tier} />)}
                  </div>
                  <div className="text-[11px] text-muted-foreground/50">{agentKey}</div>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/50">
                  {lang === "es" ? "Certificaciones" : "Certifications"}
                </span>
                <CertificationBadges earnedTiers={earnedTiers} lang={lang} />
              </div>
            </div>

            {/* Saved break resume card */}
            {savedBreak && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
                <div className="text-sm font-bold text-foreground mb-1">{t.savedSession}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {t.savedSessionDetail(
                    savedBreak.section,
                    savedBreak.currentQuestionIndex + 1,
                    savedBreak.totalQuestions,
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 rounded-lg text-primary-foreground text-xs font-bold py-2.5 hover:brightness-110 transition-all"
                    onClick={handleResume}
                  >
                    {t.resumeSession}
                  </button>
                  <button
                    className="flex-1 border border-border rounded-lg text-muted-foreground text-xs font-semibold py-2.5 hover:border-muted-foreground/30 transition-all"
                    onClick={handleDiscardBreak}
                  >
                    {t.discardSession}
                  </button>
                </div>
              </div>
            )}

            {/* Progress block */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-6">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  {lang === "es" ? "Tu progreso" : "Your Progress"}
                </span>
                <span className="text-[11px] font-bold text-primary tabular-nums">
                  {completedSections.size}/3 {lang === "es" ? "secciones" : "sections"}
                </span>
              </div>
              <div className="flex gap-2 mb-2.5">
                {(["A", "B", "C"] as const).map((sec) => {
                  const done = completedSections.has(sec);
                  return (
                    <div
                      key={sec}
                      className={`flex-1 rounded-lg py-1.5 text-center text-[11px] font-bold border transition-all ${
                        done
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-secondary/40 border-border/50 text-muted-foreground/50"
                      }`}
                    >
                      {done ? `✓ ${lang === "es" ? "Sec" : "Sec"}. ${sec}` : `Sec. ${sec}`}
                    </div>
                  );
                })}
              </div>
              <div className="text-[10px] text-muted-foreground/50">
                {progressData
                  ? `${progressData.correct}/${progressData.total}`
                  : `${localAgentProgress.correct.length}/55`}{" "}
                {lang === "es" ? "respuestas correctas acumuladas" : "cumulative correct answers"}
              </div>
            </div>

            {/* Admin panel */}
            <div className="mb-6">
              <button
                className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors"
                onClick={() => setShowAdmin(!showAdmin)}
              >
                {t.adminAccess} {showAdmin ? "▾" : "▸"}
              </button>
              {showAdmin && (
                <div className="mt-3 bg-secondary/30 border border-border/50 rounded-xl p-4">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2 block">
                    {t.sheetUrlLabel}
                  </span>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-secondary/50 border border-border rounded-lg text-foreground text-xs py-2 px-3 outline-none focus:border-primary/40 placeholder:text-muted-foreground/30 transition-colors"
                      placeholder={t.sheetUrlPlaceholder}
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                    />
                    <button
                      className="bg-primary/15 border border-primary/30 rounded-lg text-primary text-xs font-bold px-3 hover:bg-primary/25 transition-colors disabled:opacity-30"
                      disabled={!sheetUrl.trim()}
                    >
                      {t.loadQuestions}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground/40 text-center mb-3.5">{t.passThreshold}</div>

            <button
              className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-[15px] font-bold py-3.5 tracking-wide hover:brightness-110 transition-all"
              onClick={() => setScreen("section")}
            >
              {lang === "es" ? "Seleccionar Sección →" : "Select Section →"}
            </button>
          </div>
        )}

        {/* ── SECTION PICKER ── */}
        {screen === "section" && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-base font-bold text-foreground">{displayName}</span>
                {[...earnedTiers].map((tier) => <TierBadge key={tier} tier={tier} />)}
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === "es" ? "Elige una sección para comenzar" : "Choose a section to begin"}
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              {(["A", "B", "C"] as Section[]).map((sec) => {
                const labels: Record<Section, { title: string; desc: string }> = {
                  A: {
                    title: lang === "es" ? "Sección A" : "Section A",
                    desc: lang === "es" ? "Operación diaria y producto" : "Daily operations & product",
                  },
                  B: {
                    title: lang === "es" ? "Sección B" : "Section B",
                    desc: lang === "es" ? "Herramientas del día a día (Acordeón)" : "Daily tools (Acordeón)",
                  },
                  C: {
                    title: lang === "es" ? "Sección C" : "Section C",
                    desc: lang === "es" ? "Plataformas (CORAA, ODS)" : "Platforms (CORAA, ODS)",
                  },
                  All: { title: "All", desc: "" },
                };
                const count = sec === "A" ? sectionCounts.A : sec === "B" ? sectionCounts.B : sectionCounts.C;
                const isDone = completedSections.has(sec);
                return (
                  <button
                    key={sec}
                    className={`w-full rounded-xl p-4 text-left transition-all group border ${
                      isDone
                        ? "bg-success/5 border-success/30 hover:border-success/50 hover:bg-success/10"
                        : "bg-secondary/40 border-border hover:border-primary/40 hover:bg-primary/5"
                    }`}
                    onClick={() => handleSectionStart(sec, false)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`font-bold text-sm transition-colors ${isDone ? "text-success group-hover:text-success" : "text-foreground group-hover:text-primary"}`}>
                          {isDone && "✓ "}{labels[sec].title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {isDone
                            ? (lang === "es" ? "Completada · Puedes repetirla" : "Completed · Can retake")
                            : labels[sec].desc}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-extrabold transition-colors ${isDone ? "text-success/60 group-hover:text-success" : "text-primary/60 group-hover:text-primary"}`}>
                          {count}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          {lang === "es" ? "preguntas" : "questions"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Test mode */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">
                    {lang === "es" ? "Modo Prueba Rápida" : "Quick Test Mode"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {lang === "es"
                      ? "Solo 3 preguntas · Ideal para verificar que todo funciona"
                      : "Only 3 questions · Ideal for verifying everything works"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {(["A", "B", "C"] as Section[]).map((sec) => (
                  <button
                    key={sec}
                    className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-bold py-2 hover:bg-amber-500/20 transition-colors"
                    onClick={() => handleSectionStart(sec, true)}
                  >
                    {`Sec. ${sec}`} · 3
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full bg-transparent border border-border rounded-xl text-muted-foreground text-sm font-semibold py-3 hover:border-muted-foreground/30 transition-all"
              onClick={() => setScreen("start")}
            >
              ← {lang === "es" ? "Volver" : "Back"}
            </button>
          </div>
        )}

        {/* ── QUIZ SCREEN ── */}
        {screen === "quiz" && q && (
          <>
            {testMode && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 mb-4 text-[11px] font-bold text-amber-400 uppercase tracking-wider text-center">
                {lang === "es" ? "Modo Prueba Rápida" : "Quick Test Mode"} · 3{" "}
                {lang === "es" ? "preguntas" : "questions"}
              </div>
            )}
            <QuizQuestionView
              key={q.id}
              question={q}
              lang={lang}
              agentName={displayName}
              currentIndex={currentQ}
              totalQuestions={sessionQuestions.length}
              onSubmitAnswer={handleSubmitAnswer}
              grading={grading}
              graded={graded}
              isCorrect={isCorrect}
              feedback={feedback}
              correctAnswer={correctAnswer}
              onNext={handleNext}
              onBreak={handleBreak}
              isLast={currentQ + 1 >= sessionQuestions.length}
            />
          </>
        )}

        {/* ── RESULTS SCREEN ── */}
        {screen === "results" && (
          <QuizResults
            lang={lang}
            agentName={displayName}
            earnedTier={justEarned ?? ([...earnedTiers][earnedTiers.size - 1] ?? null)}
            section={selectedSection}
            results={sessionResults}
            totalQuestions={sessionQuestions.length || sessionResults.length}
            cumulativeCorrect={liveCorrect}
            cumulativeTotal={liveTotal}
            justEarned={!!justEarned}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
