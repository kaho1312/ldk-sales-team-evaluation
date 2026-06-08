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
  getActiveAttempt,
  getAttemptAnswers,
  getCompletedSections,
  getSectionProgress,
} from "@/lib/api";
import { CertificationBadges } from "@/components/CertificationBadges";
import { toast } from "sonner";

// ── localStorage keys (certification cache only) ──────────────────────────────
const EARNED_TIER_KEY = (email: string, tier: string) => `ldk_earned_tier_${tier}_${email}`;
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

// Map backend tier strings to display names
function tierKey(dbTier: string): string {
  if (dbTier === "junior") return "Junior";
  if (dbTier === "mid-level") return "Mid-Level";
  return "Senior";
}

interface SavedBreak {
  attemptId: string;
  section: Section;
  currentQuestionIndex: number;
  answers: { id: string; question: string; isCorrect: boolean; feedback: string; correctAnswer: string }[];
  totalQuestions: number;
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

  // Certifications — initialized from localStorage cache, refreshed from backend
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

  // Backend attempt tracking
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [quizConfig, setQuizConfig] = useState<{ total_questions: number; passing_threshold: number }>({
    total_questions: 55,
    passing_threshold: 0.9,
  });

  // Backend progress (async, replaces localStorage progress bar)
  const [progressData, setProgressData] = useState<{ correct: number; total: number; certified: boolean } | null>(null);
  const [sectionProgress, setSectionProgress] = useState<{ A: number; B: number; C: number }>({ A: 0, B: 0, C: 0 });

  // Local progress (fast, shown while backend loads)
  const localAgentProgress = getAgentProgress(agentKey);
  const localProgressPercent = getProgressPercent(agentKey);

  const progressPercent = progressData
    ? Math.round((progressData.correct / progressData.total) * 100)
    : localProgressPercent;

  const certifiedOverall = progressData?.certified ?? localAgentProgress.certified;

  // Questions
  const [allQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [savedBreak, setSavedBreak] = useState<SavedBreak | null>(null);

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

  // ── Load backend data on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    // Check backend for in-progress attempt (break/resume)
    checkForActiveAttempt(user.id);

    // Load certifications from backend and sync to local cache
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

    // Load progress from backend
    getUserProgress(user.id, "junior").then(setProgressData);

    // Load completed sections + per-section progress
    getCompletedSections(user.id, "junior").then(setCompletedSections);
    getSectionProgress(user.id, "junior").then(setSectionProgress);

    // Load quiz config
    getActiveConfig("junior").then((config) => {
      if (config) {
        setQuizConfig({
          total_questions: config.total_questions,
          passing_threshold: config.passing_threshold,
        });
      }
    });

  }, [user?.id]);

  // ── Check backend for in-progress attempt (break/resume) ─────────────────
  async function checkForActiveAttempt(userId: string) {
    try {
      const active = await getActiveAttempt(userId, "junior");
      if (!active) { setSavedBreak(null); return; }
      const answers = await getAttemptAnswers(active.id);
      if (!answers.length) { setSavedBreak(null); return; }
      const rawSection = answers[0].section;
      const section = (rawSection === "All" ? "A" : rawSection) as Section;
      const totalMap: Record<Section, number> = { A: 28, B: 13, C: 14, All: 55 };
      setCurrentAttemptId(active.id);
      setSavedBreak({
        attemptId: active.id,
        section,
        currentQuestionIndex: answers.length,
        answers: answers.map((a) => ({
          id: a.question_id,
          question: "",
          isCorrect: !!a.ai_grade,
          feedback: "",
          correctAnswer: "",
        })),
        totalQuestions: totalMap[section] ?? 28,
      });
    } catch {
      setSavedBreak(null);
    }
  }

  // Refresh progress, sections and in-progress break after returning to start screen
  useEffect(() => {
    if (screen === "start" && user) {
      getUserProgress(user.id, "junior").then(setProgressData);
      getCompletedSections(user.id, "junior").then(setCompletedSections);
      getSectionProgress(user.id, "junior").then(setSectionProgress);
      checkForActiveAttempt(user.id);
    }
  }, [screen, user?.id]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  // ── Resume from break ────────────────────────────────────────────────────
  const handleResume = () => {
    if (!savedBreak) return;
    setSelectedSection(savedBreak.section);
    setCurrentQ(savedBreak.currentQuestionIndex);
    setTestMode(false);
    resetGrading();
    setSavedBreak(null);
    setScreen("quiz");
  };

  const handleDiscardBreak = () => {
    // Complete the in-progress attempt so it doesn't reappear
    if (savedBreak?.attemptId) {
      completeAttempt(savedBreak.attemptId, quizConfig).catch(() => {});
    }
    setCurrentAttemptId(null);
    setSavedBreak(null);
  };

  // ── Take a break ─────────────────────────────────────────────────────────
  const handleBreak = () => {
    // Answers are already saved to the backend per question — just go to start.
    // The start screen useEffect will re-check the backend and restore the resume card.
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
    setScreen("quiz"); // switch immediately — don't wait for backend

    // Start a backend attempt in the background (non-blocking)
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
      const graderUrl = import.meta.env.VITE_GRADER_URL as string;
      const graderKey = import.meta.env.VITE_GRADER_KEY as string | undefined;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (graderKey) headers["x-api-key"] = graderKey;

      const res = await fetch(graderUrl, {
        method: "POST",
        headers,
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

      // Write to backend (authoritative record)
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
          // Fall back to local check if backend fails
          const latestProgress = getAgentProgress(agentKey);
          if (latestProgress.certified && !earnedTiers.has(activeTier)) {
            saveEarnedTierLocal(agentKey, activeTier);
            setEarnedTiers((prev) => new Set([...prev, activeTier]));
            setJustEarned(activeTier);
          }
        }
      } else {
        // No backend attempt — use local check
        const latestProgress = getAgentProgress(agentKey);
        if (latestProgress.certified && !earnedTiers.has(activeTier)) {
          saveEarnedTierLocal(agentKey, activeTier);
          setEarnedTiers((prev) => new Set([...prev, activeTier]));
          setJustEarned(activeTier);
        }
      }

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
    setSavedBreak(null); // start screen useEffect will re-check backend
    setScreen("start");
  };

  // Backend progress for the results screen (reload after attempt)
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
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
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
                  const total = sectionCounts[sec] ?? 1;
                  const answered = Math.min(sectionProgress[sec], total);
                  const pct = Math.round((answered / total) * 100);
                  return (
                    <div
                      key={sec}
                      className={`flex-1 relative rounded-lg py-1.5 text-center text-[11px] font-bold border transition-all overflow-hidden ${
                        done
                          ? "bg-success/10 border-success/30 text-success"
                          : "bg-secondary/40 border-border/50 text-muted-foreground/50"
                      }`}
                    >
                      {done ? `✓ Sec. ${sec}` : `Sec. ${sec}`}
                      <div
                        className={`absolute bottom-0 left-0 h-0.5 transition-all duration-500 ${done ? "bg-success/60" : "bg-primary/50"}`}
                        style={{ width: `${pct}%` }}
                      />
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
                const answered = Math.min(sectionProgress[sec], count);
                const pct = count > 0 ? Math.round((answered / count) * 100) : 0;
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
                    <div className="mt-2.5 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-success/70" : "bg-primary/60"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`text-[10px] mt-1 ${isDone ? "text-success/60" : "text-muted-foreground/50"}`}>
                      {answered}/{count} {lang === "es" ? "respondidas" : "answered"}
                    </div>
                  </button>
                );
              })}
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
