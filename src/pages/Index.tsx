import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

import { getAgentProgress, saveAnswer, getProgressPercent } from "@/lib/progress";
import { getCurrentSession, logout } from "@/lib/auth";
import { CertificationBadges } from "@/components/CertificationBadges";
import { toast } from "sonner";

// ── localStorage keys ────────────────────────────────────────────────────────
// Each tier has its own key so multiple certs can be earned independently
const EARNED_TIER_KEY = (email: string, tier: string) => `ldk_earned_tier_${tier}_${email}`;
const BREAK_KEY = (email: string) => `ldk_break_${email}`;
const SHEET_URL_KEY = "ldk_quiz_sheet_url";

const ALL_TIERS = ["Junior", "Mid-Level", "Senior"] as const;

function getEarnedTiers(email: string): Set<string> {
  const earned = new Set<string>();
  for (const tier of ALL_TIERS) {
    if (localStorage.getItem(EARNED_TIER_KEY(email, tier))) earned.add(tier);
  }
  // Backward compat: check old single-key format
  const legacy = localStorage.getItem(`ldk_earned_tier_${email}`);
  if (legacy) earned.add(legacy);
  return earned;
}

function saveEarnedTier(email: string, tier: string) {
  localStorage.setItem(EARNED_TIER_KEY(email, tier), "1");
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

// ── Tier badge component ─────────────────────────────────────────────────────
function TierBadge({ tier }: { tier: string }) {
  const styles =
    tier === "Junior"
      ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
      : tier === "Mid-Level"
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${styles}`}>{tier} Agent</span>;
}

export default function Index() {
  const navigate = useNavigate();
  const session = getCurrentSession()!;
  const agentKey = session.email; // unique key for progress storage
  const displayName = `${session.firstName} ${session.lastName}`;

  const [lang, setLang] = useState<Lang>("es");
  const [screen, setScreen] = useState<"start" | "section" | "quiz" | "results" | "leaderboard">("start");
  const [earnedTiers, setEarnedTiers] = useState<Set<string>>(() => getEarnedTiers(agentKey));
  const [justEarned, setJustEarned] = useState<string | null>(null); // tier name just earned, or null

  // Section selection
  const [selectedSection, setSelectedSection] = useState<Section>("A");

  // Test mode (3 questions only)
  const [testMode, setTestMode] = useState(false);

  // Grading state
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Session
  const [currentQ, setCurrentQ] = useState(0);
  const [sessionResults, setSessionResults] = useState<{ id: string; question: string; isCorrect: boolean }[]>([]);

  // Questions
  const [allQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");
  const [showAdmin, setShowAdmin] = useState(false);

  // Saved break
  const [savedBreak, setSavedBreak] = useState<SavedBreak | null>(() => getSavedBreak(agentKey));

  const t = LANG[lang];

  // Questions for current section (full set)
  const sectionQuestions = useMemo(
    () => getByTierAndSection(allQuestions, "Junior", selectedSection),
    [allQuestions, selectedSection],
  );

  // Active session questions: limited to 3 in test mode
  const sessionQuestions = useMemo(
    () => (testMode ? sectionQuestions.slice(0, 3) : sectionQuestions),
    [sectionQuestions, testMode],
  );

  const sectionCounts = useMemo(() => getSectionCounts(allQuestions, "Junior"), [allQuestions]);

  const q = sessionQuestions[currentQ];

  const progressPercent = getProgressPercent(agentKey);
  const agentProgress = getAgentProgress(agentKey);

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── Resume from break ──────────────────────────────────────────────────
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

  // ── Take a break ──────────────────────────────────────────────────────
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

  // ── Section selection → start quiz ──────────────────────────────────────
  const handleSectionStart = (section: Section, isTestMode = false) => {
    setSelectedSection(section);
    setTestMode(isTestMode);
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setScreen("quiz");
  };

  const resetGrading = () => {
    setGrading(false);
    setGraded(false);
    setIsCorrect(null);
    setFeedback("");
    setCorrectAnswer("");
  };

  // ── Submit answer to Lambda ──────────────────────────────────────────────
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
      const res = await fetch("https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      saveAnswer(agentKey, q.id, correct);
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: correct }]);
    } catch {
      setIsCorrect(false);
      setFeedback(
        lang === "es" ? "Error al conectar con el servidor de evaluación." : "Error connecting to grading server.",
      );
      setCorrectAnswer("");
      setGraded(true);
      setGrading(false);
    }
  };

  // ── Next question or finish ──────────────────────────────────────────────
  const handleNext = () => {
    if (currentQ + 1 >= sessionQuestions.length) {
      const correctCount = sessionResults.filter((r) => r.isCorrect).length + (isCorrect ? 1 : 0);
      const score = Math.round((correctCount / sessionQuestions.length) * 100);

      // Currently only Junior tier is achievable (Mid-Level & Senior questions TBD)
      const activeTier = "Junior";
      if (score >= 90 && !earnedTiers.has(activeTier)) {
        saveEarnedTier(agentKey, activeTier);
        setEarnedTiers((prev) => new Set([...prev, activeTier]));
        setJustEarned(activeTier);
      }

      clearSavedBreak(agentKey);
      setScreen("results");
      return;
    }
    setCurrentQ((p) => p + 1);
    resetGrading();
  };

  // ── Restart ──────────────────────────────────────────────────────────────
  const handleRestart = () => {
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setJustEarned(null);
    setTestMode(false);
    setSavedBreak(getSavedBreak(agentKey));
    setScreen("start");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {/* ── Title + tabs (start / leaderboard) ── */}
        {(screen === "start" || screen === "leaderboard" || screen === "section") && (
          <div className="mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl sm:text-[27px] font-extrabold text-foreground tracking-tight mb-1.5">{t.title}</h1>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.startDesc}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground/40 hover:text-destructive/60 transition-colors mt-1 shrink-0 ml-4"
              >
                {lang === "es" ? "Salir" : "Logout"}
              </button>
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
                    {[...earnedTiers].map((t) => <TierBadge key={t} tier={t} />)}
                  </div>
                  <div className="text-[11px] text-muted-foreground/50">{session.email}</div>
                </div>
              </div>
              {/* Certification badge placeholders */}
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

            {/* Progress bar */}
            <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  {lang === "es" ? "Tu progreso" : "Your Progress"}
                </span>
                <span className="text-xs font-bold text-primary tabular-nums">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    agentProgress?.certified ? "bg-success" : "bg-gradient-to-r from-primary/60 to-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-[10px] text-muted-foreground/50 mt-1.5">
                {agentProgress?.correct.length || 0}/55 {lang === "es" ? "correctas" : "correct"}
                {(agentProgress?.wrong.length || 0) > 0 &&
                  ` · ${agentProgress?.wrong.length} ${lang === "es" ? "incorrectas" : "wrong"}`}
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
                {[...earnedTiers].map((t) => <TierBadge key={t} tier={t} />)}
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
                return (
                  <button
                    key={sec}
                    className="w-full bg-secondary/40 border border-border hover:border-primary/40 hover:bg-primary/5 rounded-xl p-4 text-left transition-all group"
                    onClick={() => handleSectionStart(sec, false)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                          {labels[sec].title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{labels[sec].desc}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-primary/60 group-hover:text-primary transition-colors">
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
                    {lang === "es" ? `Sec. ${sec}` : `Sec. ${sec}`} · 3
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
                {lang === "es" ? "Modo Prueba Rápida" : "Quick Test Mode"} · 3 {lang === "es" ? "preguntas" : "questions"}
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
            justEarned={!!justEarned}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
