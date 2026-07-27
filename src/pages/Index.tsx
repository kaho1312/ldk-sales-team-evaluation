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
  SectionMeta,
  Tier,
  TIER_SECTION_META,
  getByTierAndSection,
  getSectionCounts,
  getSectionsForTier,
  parseSheetQuestions,
} from "@/lib/questions";
import { saveAnswer, getAgentProgress, getProgressPercent } from "@/lib/progress";
import type { CertStatus } from "@/lib/scoring";
import { logout } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import {
  startAttempt,
  saveAnswerToAttempt,
  completeAttempt,
  getCertStatus,
  getUserCertifications,
  getUserProgress,
  getActiveConfig,
  getActiveAttempts,
  getCompletedSections,
  getSectionProgress,
  getWrongAnswers,
  getQuizConfigs,
  getTierQuestionsCsv,
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

  // Selected certification tier. `dbTier` is the backend/RDS string; `sections`
  // is this tier's ordered section list (Junior A/B/C, Mid-Level A–F, or —
  // for sheet-driven tiers like Senior — whatever sections the sheet defines).
  const [tier, setTier] = useState<Tier>("Junior");
  const dbTier = tier === "Mid-Level" ? "mid-level" : tier === "Senior" ? "senior" : "junior";

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
  const [sessionResults, setSessionResults] = useState<{ id: string; question: string; isCorrect: boolean; feedback: string; correctAnswer: string; userAnswer: string }[]>([]);

  // Backend attempt tracking
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [quizConfig, setQuizConfig] = useState<{ total_questions: number; passing_threshold: number }>({
    total_questions: 55,
    passing_threshold: 0.9,
  });

  // Backend progress (async, replaces localStorage progress bar)
  const [progressData, setProgressData] = useState<{ correct: number; total: number; certified: boolean } | null>(null);
  const [sectionProgress, setSectionProgress] = useState<Record<string, number>>({ A: 0, B: 0, C: 0 });
  const [sectionStats, setSectionStats] = useState<{ correct: number; scorePercent: number } | null>(null);
  const [allWrongReview, setAllWrongReview] = useState<{ id: string; question: string; isCorrect: boolean; feedback: string; correctAnswer: string; userAnswer: string }[] | null>(null);
  // Overall (cross-section) breakdown for the results screen — derived frontend-side.
  // `answered` (questions attempted in the section) feeds the aggregate "Puntaje Total".
  const [overallSections, setOverallSections] = useState<{ section: string; correct: number; total: number; answered: number }[] | null>(null);
  const [certOnTrack, setCertOnTrack] = useState<boolean | null>(null);
  // Authoritative cumulative certification status (backend) for the results screen.
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);

  // Local progress (fast, shown while backend loads)
  const localAgentProgress = getAgentProgress(agentKey);
  const localProgressPercent = getProgressPercent(agentKey);

  const progressPercent = progressData
    ? Math.round((progressData.correct / progressData.total) * 100)
    : localProgressPercent;

  const certifiedOverall = progressData?.certified ?? localAgentProgress.certified;

  // Questions. Hardcoded tiers (Junior, Mid-Level) come from FALLBACK_QUESTIONS;
  // sheet-driven tiers (e.g. Senior) get merged in by loadExternalBanks below.
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  // Per-tier (dbTier key) section labels parsed from an external sheet.
  const [sheetSectionMeta, setSheetSectionMeta] =
    useState<Record<string, Partial<Record<Section, SectionMeta>>>>({});
  const [activeSessions, setActiveSessions] = useState<Record<string, { attemptId: string; answeredCount: number }>>({});

  const t = LANG[lang];

  // This tier's ordered section list — hardcoded for Junior/Mid-Level, derived
  // from the loaded sheet questions for sheet-driven tiers (Senior).
  const sections = useMemo(() => getSectionsForTier(allQuestions, tier), [allQuestions, tier]);

  const sectionQuestions = useMemo(
    () => getByTierAndSection(allQuestions, tier, selectedSection),
    [allQuestions, tier, selectedSection],
  );
  const sessionQuestions = useMemo(
    () => (testMode ? sectionQuestions.slice(0, 3) : sectionQuestions),
    [sectionQuestions, testMode],
  );
  const sectionCounts = useMemo(() => getSectionCounts(allQuestions, tier), [allQuestions, tier]);
  const q = sessionQuestions[currentQ];

  // ── Load backend data on mount / tier change ────────────────────────────
  // `cancelled` guards against a race: switching tiers re-runs this effect, but
  // the PREVIOUS tier's in-flight requests can resolve later and overwrite the
  // new tier's state (esp. when the old tier has lots of data / slow queries).
  // The cleanup flips `cancelled` so stale responses are dropped.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // In-progress attempts for the CURRENT tier
    loadActiveSessions(user.id, dbTier).then((m) => { if (!cancelled) setActiveSessions(m); });

    // Certifications are the SOURCE OF TRUTH for badges (DB-authoritative). Also
    // reconcile the localStorage cache so a stale/phantom tier can't linger.
    getUserCertifications(user.id).then((certs) => {
      if (cancelled) return;
      const fromDb = new Set(certs.map((c) => tierKey(c.certification_tier)));
      setEarnedTiers(fromDb);
      for (const t of ALL_TIERS) {
        if (fromDb.has(t)) saveEarnedTierLocal(agentKey, t);
        else localStorage.removeItem(EARNED_TIER_KEY(agentKey, t));
      }
    });

    // Progress / sections / config for the CURRENT tier
    getUserProgress(user.id, dbTier).then((p) => { if (!cancelled) setProgressData(p); });
    getCompletedSections(user.id, dbTier).then((s) => { if (!cancelled) setCompletedSections(s); });
    getSectionProgress(user.id, dbTier).then((s) => { if (!cancelled) setSectionProgress(s); });
    getActiveConfig(dbTier).then((config) => {
      if (cancelled || !config) return;
      setQuizConfig({
        total_questions: config.total_questions,
        passing_threshold: config.passing_threshold,
      });
    });

    return () => { cancelled = true; };
  }, [user?.id, dbTier]);

  // ── Load external (sheet-driven) question banks once ────────────────────────
  // Any active tier with a `questions_source_url` (e.g. Senior) has its questions
  // fetched via the Lambda proxy, parsed, and merged into `allQuestions`. Done up
  // front (not on tier-select) so those tiers unlock in the selector and their
  // sections render. A per-tier fetch/parse failure is swallowed so one bad sheet
  // can't break the others or the hardcoded tiers.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const configs = await getQuizConfigs();
        const sheetConfigs = configs.filter((c) => c.is_active && c.questions_source_url);
        if (sheetConfigs.length === 0) return;
        const loaded: QuizQuestion[] = [];
        const metaByTier: Record<string, Partial<Record<Section, SectionMeta>>> = {};
        const loadedTiers = new Set<string>();
        for (const cfg of sheetConfigs) {
          const displayTier = tierKey(cfg.certification_tier) as Tier;
          try {
            const { csv } = await getTierQuestionsCsv(cfg.certification_tier);
            if (!csv) continue;
            const parsed = parseSheetQuestions(csv, displayTier);
            if (parsed.questions.length) {
              loaded.push(...parsed.questions);
              metaByTier[cfg.certification_tier] = parsed.sectionMeta;
              loadedTiers.add(displayTier);
            }
          } catch { /* skip this tier's sheet */ }
        }
        if (cancelled || loaded.length === 0) return;
        // Rebuild from FALLBACK each run (idempotent): sheet questions replace any
        // hardcoded ones for the same tier.
        setAllQuestions([...FALLBACK_QUESTIONS.filter((qq) => !loadedTiers.has(qq.tier)), ...loaded]);
        setSheetSectionMeta(metaByTier);
      } catch { /* leave hardcoded tiers as-is */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Load all in-progress attempts for the current tier (returns the map so
  //    callers can apply it under a cancellation guard) ──────────────────────
  async function loadActiveSessions(userId: string, tierStr: string) {
    try {
      const sessions = await getActiveAttempts(userId, tierStr);
      const map: Record<string, { attemptId: string; answeredCount: number }> = {};
      for (const s of sessions) {
        if (!map[s.section]) {  // SQL orders DESC by answer count — keep the first (most progress) per section
          map[s.section] = { attemptId: s.attemptId, answeredCount: s.answeredCount };
        }
      }
      return map;
    } catch {
      return {};
    }
  }

  // Refresh progress, sections and active sessions after returning to start screen
  // (same cancellation guard as the mount effect).
  useEffect(() => {
    if (screen !== "start" || !user) return;
    let cancelled = false;
    getUserProgress(user.id, dbTier).then((p) => { if (!cancelled) setProgressData(p); });
    getCompletedSections(user.id, dbTier).then((s) => { if (!cancelled) setCompletedSections(s); });
    getSectionProgress(user.id, dbTier).then((s) => { if (!cancelled) setSectionProgress(s); });
    loadActiveSessions(user.id, dbTier).then((m) => { if (!cancelled) setActiveSessions(m); });
    return () => { cancelled = true; };
  }, [screen, user?.id, dbTier]);

  // ── Switch certification tier — reset all per-tier state so nothing bleeds ──
  const handleTierChange = (newTier: Tier) => {
    if (newTier === tier || getSectionsForTier(allQuestions, newTier).length === 0) return;
    setTier(newTier);
    setSelectedSection("A");
    setCompletedSections(new Set());
    setSectionProgress({});
    setActiveSessions({});
    setProgressData(null);
    setOverallSections(null);
    setCertStatus(null);
    setSectionStats(null);
    setAllWrongReview(null);
    setCertOnTrack(null);
  };

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
    if (session) {
      // Score the discarded attempt against ITS section's question count, not the
      // 55-question tier total (quizConfig) — otherwise a partial section is recorded
      // at ~25-51% against 55. (Cumulative cert uses best-grade-per-question, so this
      // partial attempt can't lower a later complete run anyway.)
      const sectionTotal = allQuestions.filter((qq) => qq.tier === tier && qq.section === section).length;
      completeAttempt(session.attemptId, {
        total_questions: sectionTotal,
        passing_threshold: quizConfig.passing_threshold,
      }).catch(() => {});
    }
    setActiveSessions((prev) => { const next = { ...prev }; delete next[section]; return next; });
    setSelectedSection(section);
    setTestMode(false);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setCurrentAttemptId(null);
    setScreen("quiz");
    if (user) {
      startAttempt(user.id, dbTier)
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
      startAttempt(user.id, dbTier)
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
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: correct, feedback: personalizedFeedback, correctAnswer: storedCorrectAnswer, userAnswer: answer }]);
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
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: false, feedback: errorFeedback, correctAnswer: "", userAnswer: answer }]);
    }
  };

  // ── Next question or finish ───────────────────────────────────────────────
  const handleNext = async () => {
    if (currentQ + 1 >= sessionQuestions.length) {
      const activeTier = tier;

      if (currentAttemptId && user) {
        try {
          const result = await completeAttempt(currentAttemptId, {
            total_questions: sessionQuestions.length,
            passing_threshold: quizConfig.passing_threshold,
          });
          // Store backend-authoritative section stats for the results display
          setSectionStats({ correct: result.total_correct, scorePercent: result.score_percent });
          // Mark this section done and compute whether ALL of this tier's sections are complete
          setCompletedSections((prev) => new Set([...prev, selectedSection!]));
          const sectionsDone = completedSections.has(selectedSection!)
            ? completedSections.size >= sections.length
            : completedSections.size + 1 >= sections.length;
          // Refresh cumulative progress so results screen shows accurate numbers
          try {
            const updated = await getUserProgress(user.id, dbTier);
            setProgressData(updated);
          } catch {}
          // Authoritative cumulative status: prefer result.cert from /complete; if the
          // backend didn't return it (e.g. old Lambda during a deploy window), ask the
          // dedicated endpoint. Drives the cert badge, verdict, and "Progreso general".
          let certInfo: CertStatus | null = result.cert ?? null;
          if (!certInfo) {
            try { certInfo = await getCertStatus(user.id, dbTier); } catch { certInfo = null; }
          }
          setCertStatus(certInfo);
          // Build the overall per-section breakdown for the "Progreso general" block +
          // on-track indicator. Prefer the backend's deduped per-section counts; fall
          // back to a frontend derivation only when cert data is unavailable.
          try {
            if (certInfo?.section_correct && certInfo.section_answered) {
              const sc = certInfo.section_correct;
              const sa = certInfo.section_answered;
              const breakdown = sections
                .map((sec) => ({
                  section: sec,
                  correct: sc[sec] ?? 0,
                  total: sectionCounts[sec] ?? 0,
                  answered: sa[sec] ?? 0,
                }))
                .filter((s) => s.answered > 0);
              setOverallSections(breakdown);
              const grandAnswered = breakdown.reduce((n, s) => n + s.answered, 0);
              const remaining = quizConfig.total_questions - grandAnswered;
              setCertOnTrack((certInfo.correct + remaining) / quizConfig.total_questions >= quizConfig.passing_threshold);
            } else {
              // Fallback (older backend): derive from section-progress minus wrong-answers.
              const [secProg, wrongs] = await Promise.all([
                getSectionProgress(user.id, dbTier),
                getWrongAnswers(user.id, dbTier),
              ]);
              const wrongBySection: Record<string, number> = {};
              for (const w of wrongs) wrongBySection[w.section] = (wrongBySection[w.section] ?? 0) + 1;
              const breakdown = sections
                .map((sec) => {
                  const total = sectionCounts[sec] ?? 0;
                  let answered = Math.min(secProg[sec] ?? 0, total);
                  let correct = Math.max(0, answered - (wrongBySection[sec] ?? 0));
                  if (sec === selectedSection) {
                    correct = result.total_correct;
                    answered = sessionQuestions.length;
                  }
                  return { section: sec, correct, total, answered };
                })
                .filter((s) => s.answered > 0);
              setOverallSections(breakdown);
              const grandCorrect = breakdown.reduce((n, s) => n + s.correct, 0);
              const grandAnswered = breakdown.reduce((n, s) => n + s.answered, 0);
              const remaining = quizConfig.total_questions - grandAnswered;
              setCertOnTrack((grandCorrect + remaining) / quizConfig.total_questions >= quizConfig.passing_threshold);
            }
          } catch {}
          if (sectionsDone) {
            try {
              const wrongFromDB = await getWrongAnswers(user.id, dbTier);
              setAllWrongReview(
                wrongFromDB.map((w) => {
                  const fq = FALLBACK_QUESTIONS.find((q) => q.id === w.questionId);
                  return {
                    id: w.questionId,
                    question: fq?.question ?? w.questionId,
                    isCorrect: false,
                    feedback: w.aiReasoning ?? "",
                    correctAnswer: "",
                    userAnswer: w.userAnswer ?? "",
                  };
                }),
              );
            } catch {}
          }
          // Certification is decided CUMULATIVELY by the backend (certInfo) across all
          // of this user's completed attempts — not by this single section's pass/fail.
          // The backend auto-grants when eligible; we just reflect the badge.
          if (certInfo?.certified && !earnedTiers.has(activeTier)) {
            saveEarnedTierLocal(agentKey, activeTier);
            setEarnedTiers((prev) => new Set([...prev, activeTier]));
            // result.cert distinguishes a fresh grant; the cert-status fallback can't,
            // so animate whenever the tier is first earned this session (guarded above).
            if (certInfo.newlyGranted !== false) setJustEarned(activeTier);
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
    setOverallSections(null);
    setCertOnTrack(null);
    setCertStatus(null);
    setScreen("start");
  };

  // Backend progress for the results screen (reload after attempt)
  const liveCorrect = progressData?.correct ?? (getAgentProgress(agentKey).correct?.length ?? 0);
  // Grand total correct across attempted sections — derived from the breakdown so it
  // reconciles with the per-section rows; denominator is the full Junior tier (55).
  const overallCorrect = overallSections
    ? overallSections.reduce((n, s) => n + s.correct, 0)
    : liveCorrect;
  // True once every section of the current tier has been submitted (this or prior sessions)
  const allSectionsDone = completedSections.size >= sections.length;

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
                    {[...earnedTiers].map((et) => <TierBadge key={et} tier={et} />)}
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

            {/* Tier selector — choose which certification to work on */}
            <div className="mb-4">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground block mb-1.5">
                {lang === "es" ? "Nivel de certificación" : "Certification level"}
              </span>
              <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
                {(["Junior", "Mid-Level", "Senior"] as const).map((tv) => {
                  const locked = getSectionsForTier(allQuestions, tv).length === 0;
                  const active = tier === tv;
                  return (
                    <button
                      key={tv}
                      disabled={locked}
                      onClick={() => handleTierChange(tv)}
                      className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                        active
                          ? "bg-primary/15 border border-primary/30 text-primary"
                          : locked
                            ? "text-muted-foreground/30 border border-transparent cursor-not-allowed"
                            : "text-muted-foreground border border-transparent hover:text-foreground/70"
                      }`}
                    >
                      {tv}{locked ? " 🔒" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress block with interactive section cards */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  {lang === "es" ? "Tu progreso" : "Your Progress"}
                </span>
                <span className="text-[11px] font-bold text-primary tabular-nums">
                  {completedSections.size}/{sections.length} {lang === "es" ? "secciones" : "sections"}
                </span>
              </div>

              <div className="flex flex-col gap-2 mb-3">
                {sections.map((sec) => {
                  const done = completedSections.has(sec);
                  const session = activeSessions[sec];
                  const isResume = !done && !!session;
                  const total = sectionCounts[sec] ?? 1;
                  const answered = Math.min(sectionProgress[sec] ?? 0, total);
                  const pct = Math.round((answered / total) * 100);
                  const meta = sheetSectionMeta[dbTier]?.[sec] ?? TIER_SECTION_META[tier]?.[sec];
                  const secTitle = (lang === "es" ? meta?.title_es : meta?.title_en) ?? `Sección ${sec}`;
                  const secDesc = (lang === "es" ? meta?.desc_es : meta?.desc_en) ?? "";
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
                            {done ? "✓ " : ""}{secTitle}
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
                              : secDesc}
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
                  : `${localAgentProgress.correct.length}/${quizConfig.total_questions}`}{" "}
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
            tier={tier}
            earnedTier={justEarned ?? ([...earnedTiers][earnedTiers.size - 1] ?? null)}
            section={selectedSection}
            results={sessionResults}
            totalQuestions={sessionQuestions.length || sessionResults.length}
            cumulativeCorrect={overallCorrect}
            cumulativeTotal={quizConfig.total_questions}
            justEarned={!!justEarned}
            allSectionsDone={allSectionsDone}
            certified={certStatus?.certified}
            sectionCorrect={sectionStats?.correct}
            sectionScorePercent={sectionStats?.scorePercent}
            overallSections={overallSections ?? undefined}
            certOnTrack={certOnTrack}
            allWrongAnswers={allSectionsDone ? (allWrongReview ?? undefined) : undefined}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
