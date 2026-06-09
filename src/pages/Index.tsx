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
  getActiveAttempts,
  getCompletedSections,
  getSectionProgress,
  getWrongAnswers,
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
  const [sectionStats, setSectionStats] = useState<{ correct: number; scorePercent: number } | null>(null);
  const [allWrongReview, setAllWrongReview] = useState<{ id: string; question: string; isCorrect: boolean; feedback: string; correctAnswer: string }[] | null>(null);

  // Local progress (fast, shown while backend loads)
  const localAgentProgress = getAgentProgress(agentKey);
  const localProgressPercent = getProgressPercent(agentKey);

  const progressPercent = progressData
    ? Math.round((progressData.correct / progressData.total) * 100)
    : localProgressPercent;

  const certifiedOverall = progressData?.certified ?? localAgentProgress.certified;

  // Questions
  const [allQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [activeSessions, setActiveSessions] = useState<Record<string, { attemptId: string; answeredCount: number }>>({});

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

    // Check backend for all in-progress attempts
    checkForActiveSessions(user.id);

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

  // ── Check all in-progress attempts for all sections ──────────────────────
  async function checkForActiveSessions(userId: string) {
    try {
      const sessions = await getActiveAttempts(userId, "junior");
      const map: Record<string, { attemptId: string; answeredCount: number }> = {};
      for (const s of sessions) {
        if (!map[s.section]) {  // SQL orders DESC by answer count — keep the first (most progress) per section
          map[s.section] = { attemptId: s.attemptId, answeredCount: s.answeredCount };
        }
      }
      setActiveSessions(map);
    } catch {
      setActiveSessions({});
    }
  }

  // Refresh progress, sections and active sessions after returning to start screen
  useEffect(() => {
    if (screen === "start" && user) {
      getUserProgress(user.id, "junior").then(setProgressData);
      getCompletedSections(user.id, "junior").then(setCompletedSections);
      getSectionProgress(user.id, "junior").then(setSectionProgress);
      checkForActiveSessions(user.id);
    }
  }, [screen, user?.id]);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    window.location.replace("/login");
  };

  // ── Resume a specific section's in-progress attempt ───────────────────────
  const handleResumeSection = (section: Section) => {
    const session = activeSessions[section];
    if (!session) return;
    setCurrentAttemptId(session.attemptId);
    setSelectedSection(section);
    setCurrentQ(session.answeredCount);
    setSessionResults([]);
    setTestMode(false);
    resetGrading();
    setActiveSessions((prev) => { const next = { ...prev }; delete next[section]; return next; });
    setScreen("quiz");
  };

  // ── Discard a section's in-progress attempt and start fresh ──────────────
  const handleDiscardAndStart = (section: Section) => {
    const session = activeSessions[section];
    if (session) completeAttempt(session.attemptId, quizConfig).catch(() => {});
    setActiveSessions((prev) => { const next = { ...prev }; delete next[section]; return next; });
    setSelectedSection(section);
    setTestMode(false);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setCurrentAttemptId(null);
    setScreen("quiz");
    if (user) {
      startAttempt(user.id, "junior")
        .then((id) => setCurrentAttemptId(id))
        .catch(() => setCurrentAttemptId(null));
    }
  };

  // ── Take a break ─────────────────────────────────────────────────────────
  const handleBreak = () => {
    toast.success(t.breakSaved);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setScreen("start");
  };

  // ── Section selection → start quiz ───────────────────────────────────────
  const handleSectionStart = (section: Section, isTestMode = false) => {
    if (!isTestMode && activeSessions[section]) {
      handleResumeSection(section);
      return;
    }
    setSelectedSection(section);
    setTestMode(isTestMode);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setCurrentAttemptId(null);
    setScreen("quiz");
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
      if (currentAttemptId) {
        saveAnswerToAttempt(
          currentAttemptId,
          q.id,
          q.section,
          answer,
          false,
          errorFeedback,
        ).catch(() => {});
      }
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: false, feedback: errorFeedback, correctAnswer: "" }]);
    }
  };

  // ── Next question or finish ───────────────────────────────────────────────
  const handleNext = async () => {
    if (currentQ + 1 >= sessionQuestions.length) {
      const activeTier = "Junior";

      if (currentAttemptId && user) {
        try {
          const result = await completeAttempt(currentAttemptId, {
            total_questions: sessionQuestions.length,
            passing_threshold: quizConfig.passing_threshold,
          });
          // Store backend-authoritative section stats for the results display
          setSectionStats({ correct: result.total_correct, scorePercent: result.score_percent });
          // Mark this section done and compute whether all 3 are now complete
          setCompletedSections((prev) => new Set([...prev, selectedSection!]));
          const sectionsDone = completedSections.has(selectedSection!)
            ? completedSections.size >= 3
            : completedSections.size + 1 >= 3;
          // Refresh cumulative progress so results screen shows accurate numbers
          try {
            const updated = await getUserProgress(user.id, "junior");
            setProgressData(updated);
          } catch {}
          if (sectionsDone) {
            try {
              const wrongFromDB = await getWrongAnswers(user.id, "junior");
              setAllWrongReview(
                wrongFromDB.map((w) => {
                  const fq = FALLBACK_QUESTIONS.find((q) => q.id === w.questionId);
                  return {
                    id: w.questionId,
                    question: fq?.question ?? w.questionId,
                    isCorrect: false,
                    feedback: w.aiReasoning ?? "",
                    correctAnswer: "",
                  };
                }),
              );
            } catch {}
          }
          if (result.passed && sectionsDone && !earnedTiers.has(activeTier)) {
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
    setActiveSessions({});
    setSectionStats(null);
    setAllWrongReview(null);
    setScreen("start");
  };

  // Backend progress for the results screen (reload after attempt)
  const liveCorrect = progressData?.correct ?? (getAgentProgress(agentKey).correct?.length ?? 0);
  const liveTotal = progressData?.total || 55;
  // True once all 3 sections (A, B, C) have been submitted in this or prior sessions
  const allSectionsDone = completedSections.size >= 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {/* ── Title + tabs (start / leaderboard) ── */}
        {(screen === "start" || screen === "leaderboard") && (
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

        {(screen === "start" || screen === "leaderboard") && (
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

            {/* Progress block with interactive section cards */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  {lang === "es" ? "Tu progreso" : "Your Progress"}
                </span>
                <span className="text-[11px] font-bold text-primary tabular-nums">
                  {completedSections.size}/3 {lang === "es" ? "secciones" : "sections"}
                </span>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {(["A", "B", "C"] as const).map((sec) => {
                  const done = completedSections.has(sec);
                  const session = activeSessions[sec];
                  const isResume = !done && !!session;
                  const total = sectionCounts[sec] ?? 1;
                  const answered = Math.min(sectionProgress[sec], total);
                  const pct = Math.round((answered / total) * 100);
                  const sectionLabels: Record<string, { title: string; desc: string }> = {
                    A: { title: lang === "es" ? "Sección A" : "Section A", desc: lang === "es" ? "Operación diaria y producto" : "Daily operations & product" },
                    B: { title: lang === "es" ? "Sección B" : "Section B", desc: lang === "es" ? "Herramientas del día a día" : "Daily tools (Acordeón)" },
                    C: { title: lang === "es" ? "Sección C" : "Section C", desc: lang === "es" ? "Plataformas (CORAA, ODS)" : "Platforms (CORAA, ODS)" },
                  };
                  return (
                    <div
                      key={sec}
                      className={`rounded-xl border overflow-hidden transition-all ${
                        isResume
                          ? "bg-primary/8 border-primary/40"
                          : done
                            ? "bg-success/5 border-success/20"
                            : "bg-secondary/40 border-border/50"
                      }`}
                    >
                      <button
                        className="w-full p-3 text-left hover:brightness-110 transition-all"
                        onClick={() => handleSectionStart(sec)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-xs font-bold ${isResume ? "text-primary" : done ? "text-success" : "text-foreground"}`}>
                            {done ? "✓ " : ""}{sectionLabels[sec].title}
                          </div>
                          <div className={`text-xs font-bold tabular-nums ${isResume ? "text-primary/60" : done ? "text-success/50" : "text-muted-foreground/40"}`}>
                            {total} {lang === "es" ? "pregs." : "qs."}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 mb-2">
                          {isResume
                            ? (lang === "es" ? `Continuar desde pregunta ${session.answeredCount + 1}` : `Resume from question ${session.answeredCount + 1}`)
                            : done
                              ? (lang === "es" ? "Completada · Haz clic para repetir" : "Completed · Click to retake")
                              : sectionLabels[sec].desc}
                        </div>
                        <div className="h-1 bg-secondary/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${done ? "bg-success/70" : isResume ? "bg-primary" : "bg-primary/40"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className={`text-[10px] mt-1 ${isResume ? "text-primary/60" : done ? "text-success/50" : "text-muted-foreground/40"}`}>
                          {answered}/{total} {lang === "es" ? "respondidas" : "answered"}
                        </div>
                      </button>
                      {isResume && (
                        <div className="px-3 pb-2">
                          <button
                            className="text-[10px] text-muted-foreground/40 hover:text-destructive/60 transition-colors"
                            onClick={() => handleDiscardAndStart(sec)}
                          >
                            ↩ {lang === "es" ? "Empezar de nuevo" : "Start over"}
                          </button>
                        </div>
                      )}
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

            <div className="text-xs text-muted-foreground/40 text-center">{t.passThreshold}</div>
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
            allSectionsDone={allSectionsDone}
            sectionCorrect={sectionStats?.correct}
            sectionScorePercent={sectionStats?.scorePercent}
            allWrongAnswers={allSectionsDone ? (allWrongReview ?? undefined) : undefined}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
