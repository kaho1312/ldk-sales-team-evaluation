import { useState, useEffect, useMemo } from "react";
import { QuizHeader } from "@/components/QuizHeader";
import { AgentSelector } from "@/components/AgentSelector";
import { QuizQuestionView } from "@/components/QuizQuestion";
import { QuizResults } from "@/components/QuizResults";
import { Leaderboard } from "@/components/Leaderboard";
import { LANG, Lang } from "@/lib/i18n";
import {
  QuizQuestion,
  FALLBACK_QUESTIONS,
  fetchQuestionsFromSheet,
} from "@/lib/questions";

import {
  getAgentProgress,
  getSessionQuestions,
  saveAnswer,
  getProgressPercent,
} from "@/lib/progress";

const TIERS = ["Mid", "Senior", "Lead"] as const;

const AGENT_TIER_KEY = "ldk_agent_tiers";
const SHEET_URL_KEY = "ldk_quiz_sheet_url";

function getStoredAgentTier(name: string): typeof TIERS[number] | null {
  try {
    const stored = JSON.parse(localStorage.getItem(AGENT_TIER_KEY) || "{}");
    return TIERS.includes(stored[name]) ? stored[name] : null;
  } catch { return null; }
}

function storeAgentTier(name: string, tier: typeof TIERS[number]) {
  try {
    const stored = JSON.parse(localStorage.getItem(AGENT_TIER_KEY) || "{}");
    stored[name] = tier;
    localStorage.setItem(AGENT_TIER_KEY, JSON.stringify(stored));
  } catch {}
}

export default function Index() {
  const [lang, setLang] = useState<Lang>("es");
  const [screen, setScreen] = useState<"start" | "quiz" | "results" | "leaderboard">("start");
  const [agentName, setAgentName] = useState("");
  const [tier, setTier] = useState<typeof TIERS[number] | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);

  // Grading state
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Session results for results screen
  const [sessionResults, setSessionResults] = useState<{ id: string; question: string; isCorrect: boolean }[]>([]);

  // Questions state
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetLoaded, setSheetLoaded] = useState(false);

  // Session question IDs (selected on start)
  const [sessionIds, setSessionIds] = useState<string[]>([]);

  const t = LANG[lang];

  const sessionQuestions = useMemo(
    () => sessionIds.map((id) => allQuestions.find((q) => q.id === id)).filter(Boolean) as QuizQuestion[],
    [sessionIds, allQuestions]
  );

  const q = sessionQuestions[currentQ];

  useEffect(() => {
    const stored = localStorage.getItem(SHEET_URL_KEY);
    if (stored) loadFromSheet(stored);
  }, []);

  const loadFromSheet = async (url: string) => {
    if (!url.trim()) return;
    setLoadingSheet(true);
    const { questions, errors } = await fetchQuestionsFromSheet(url.trim());
    if (errors.length > 0) console.warn("Sheet load warnings:", errors);
    setAllQuestions(questions);
    setSheetLoaded(questions !== FALLBACK_QUESTIONS);
    localStorage.setItem(SHEET_URL_KEY, url.trim());
    setLoadingSheet(false);
  };

  const handleStart = () => {
    if (!agentName) return;
    const allIds = allQuestions.map((q) => q.id);
    const ids = getSessionQuestions(agentName, allIds, 15);
    if (ids.length === 0) {
      // All questions answered - go straight to results
      setScreen("results");
      return;
    }
    setSessionIds(ids);
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

  const handleSubmitAnswer = async (answer: string) => {
    if (!q) return;
    setGrading(true);

    const qd = q[lang];
    const payload = { question: qd.question, answer };
    console.log("Grading payload:", JSON.stringify(payload));

    try {
      const res = await fetch(
        "https://b5sk52hgpymcgmg3knpgzyjwim0dcpwr.lambda-url.us-east-1.on.aws/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      console.log("Grading response status:", res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Grading response error body:", errorText);
        throw new Error(`Server returned ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log("Grading response data:", data);
      const correct = !!data.passed;

      setIsCorrect(correct);
      setFeedback(data.feedback || "");
      setCorrectAnswer(!correct && data.correct_answer ? data.correct_answer : "");
      setGraded(true);
      setGrading(false);

      saveAnswer(agentName, q.id, correct);
      setSessionResults((prev) => [...prev, { id: q.id, question: qd.question, isCorrect: correct }]);
    } catch (err: any) {
      console.error("Grading error:", err?.message || err);
      console.error("Grading error full:", err);
      setIsCorrect(false);
      setFeedback(lang === "es" ? "Error al conectar con el servidor de evaluación." : "Error connecting to grading server.");
      setCorrectAnswer("");
      setGraded(true);
      setGrading(false);
    }
  };

  const handleNext = () => {
    if (currentQ + 1 >= sessionQuestions.length) {
      setScreen("results");
      return;
    }
    setCurrentQ((p) => p + 1);
    resetGrading();
  };

  const handleRestart = () => {
    setSessionResults([]);
    setCurrentQ(0);
    resetGrading();
    setAgentName("");
    setTier(null);
    setSessionIds([]);
    setScreen("start");
  };

  const progressPercent = agentName ? getProgressPercent(agentName) : 0;
  const agentProgress = agentName ? getAgentProgress(agentName) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {(screen === "start" || screen === "leaderboard") && (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[27px] font-extrabold text-foreground tracking-tight mb-1.5">
              {t.title}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.startDesc}</p>
          </div>
        )}

        {/* Tab bar for start/leaderboard */}
        {(screen === "start" || screen === "leaderboard") && (
          <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5 mb-6">
            <button
              className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${
                screen === "start"
                  ? "bg-primary/15 border border-primary/30 text-primary"
                  : "text-muted-foreground border border-transparent hover:text-foreground/60"
              }`}
              onClick={() => setScreen("start")}
            >
              {lang === "es" ? "Quiz" : "Quiz"}
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

        {screen === "start" && (
          <div>

            <AgentSelector lang={lang} agentName={agentName} onSelect={(name) => {
              setAgentName(name);
              const stored = getStoredAgentTier(name);
              setTier(stored);
            }} />

            {/* Progress indicator for selected agent */}
            {agentName && (
              <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                    {lang === "es" ? "Tu progreso" : "Your Progress"}
                  </span>
                  <span className="text-xs font-bold text-primary tabular-nums">{progressPercent}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      agentProgress?.certified
                        ? "bg-success"
                        : "bg-gradient-to-r from-primary/60 to-primary"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {agentProgress?.certified && (
                  <div className="text-[11px] font-bold text-success mt-2">
                    ✓ {lang === "es" ? "Agente Junior Certificada" : "Junior Agent Certified"}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground/50 mt-1">
                  {agentProgress?.correct.length || 0}/55 {lang === "es" ? "correctas" : "correct"}
                  {(agentProgress?.wrong.length || 0) > 0 && ` · ${agentProgress?.wrong.length} ${lang === "es" ? "incorrectas" : "wrong"}`}
                </div>
              </div>
            )}

            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3 block">
              {t.tierLabel}
            </span>
            <div className="relative mb-6">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-500"
                  style={{ width: !agentName || !tier ? "0%" : tier === "Mid" ? "33%" : tier === "Senior" ? "66%" : "100%" }}
                />
              </div>
              <div className="flex justify-between mt-2.5">
                {TIERS.map((tv, i) => (
                  <button
                    key={tv}
                    className={`text-xs font-semibold transition-all ${
                      tier === tv ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                    } ${!agentName ? "opacity-40 cursor-not-allowed" : ""}`}
                    onClick={() => {
                      if (!agentName) return;
                      setTier(tv);
                      storeAgentTier(agentName, tv);
                    }}
                    disabled={!agentName}
                  >
                    {t.tiers[i]}
                  </button>
                ))}
              </div>
              <div className="absolute top-0 left-0 right-0 flex justify-between" style={{ transform: "translateY(-25%)" }}>
                {TIERS.map((tv, i) => (
                  <div
                    key={tv}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer ${
                      agentName && tier && TIERS.indexOf(tier) >= i
                        ? "bg-primary border-primary"
                        : "bg-secondary border-border"
                    } ${!agentName ? "cursor-not-allowed" : ""}`}
                    style={{ position: "absolute", left: i === 0 ? "calc(33% - 7px)" : i === 1 ? "calc(66% - 7px)" : "calc(100% - 7px)" }}
                    onClick={() => {
                      if (!agentName) return;
                      setTier(tv);
                      storeAgentTier(agentName, tv);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Admin access */}
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
                      onClick={() => loadFromSheet(sheetUrl)}
                      disabled={loadingSheet || !sheetUrl.trim()}
                    >
                      {loadingSheet ? "..." : t.loadQuestions}
                    </button>
                  </div>
                  {sheetLoaded && (
                    <div className="text-[11px] text-success mt-1.5">
                      ✓ {allQuestions.length} {t.questionsLoaded}
                    </div>
                  )}
                  {!sheetLoaded && sheetUrl && !loadingSheet && (
                    <div className="text-[11px] text-muted-foreground mt-1.5">{t.usingFallback}</div>
                  )}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground/40 text-center mb-3.5">
              {t.passThreshold}
            </div>

            <button
              className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-[15px] font-bold py-3.5 tracking-wide hover:brightness-110 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={handleStart}
              disabled={!agentName}
            >
              {t.start} →
            </button>
          </div>
        )}

        {screen === "quiz" && q && (
          <QuizQuestionView
            key={q.id}
            question={q}
            lang={lang}
            agentName={agentName}
            currentIndex={currentQ}
            totalQuestions={sessionQuestions.length}
            onSubmitAnswer={handleSubmitAnswer}
            grading={grading}
            graded={graded}
            isCorrect={isCorrect}
            feedback={feedback}
            correctAnswer={correctAnswer}
            onNext={handleNext}
            isLast={currentQ + 1 >= sessionQuestions.length}
          />
        )}

        {screen === "results" && (
          <QuizResults
            lang={lang}
            agentName={agentName}
            tier={tier}
            results={sessionResults}
            totalQuestions={sessionQuestions.length || sessionResults.length}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
