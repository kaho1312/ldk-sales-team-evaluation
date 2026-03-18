import { useState, useEffect } from "react";
import { QuizHeader } from "@/components/QuizHeader";
import { AgentSelector } from "@/components/AgentSelector";
import { QuizQuestionView } from "@/components/QuizQuestion";
import { QuizResults } from "@/components/QuizResults";
import { LANG, Lang } from "@/lib/i18n";
import {
  QuizQuestion,
  FALLBACK_QUESTIONS,
  fetchQuestionsFromSheet,
  getQuestionsForTier,
} from "@/lib/questions";

const TIERS = ["Mid", "Senior", "Lead"] as const;
type TierType = typeof TIERS[number] | null;

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
  const [screen, setScreen] = useState<"start" | "quiz" | "results">("start");
  const [agentName, setAgentName] = useState("");
  const [tier, setTier] = useState<TierType>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [coaching, setCoaching] = useState("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [results, setResults] = useState<{ id: string; question: string; isCorrect: boolean }[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);

  // Questions state
  const [allQuestions, setAllQuestions] = useState<QuizQuestion[]>(FALLBACK_QUESTIONS);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(SHEET_URL_KEY) || "");
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetLoaded, setSheetLoaded] = useState(false);

  const t = LANG[lang];
  const tierQuestions = getQuestionsForTier(allQuestions, tier || "Mid");
  const q = tierQuestions[currentQ];
  const qd = q ? q[lang] : null;

  // Auto-load sheet on mount if URL is stored
  useEffect(() => {
    const stored = localStorage.getItem(SHEET_URL_KEY);
    if (stored) {
      loadFromSheet(stored);
    }
  }, []);

  const loadFromSheet = async (url: string) => {
    if (!url.trim()) return;
    setLoadingSheet(true);
    const questions = await fetchQuestionsFromSheet(url.trim());
    setAllQuestions(questions);
    setSheetLoaded(questions !== FALLBACK_QUESTIONS);
    localStorage.setItem(SHEET_URL_KEY, url.trim());
    setLoadingSheet(false);
  };

  const handleStart = () => {
    if (!agentName) return;
    setResults([]);
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setCoaching("");
    setScreen("quiz");
  };

  const handleSelect = async (letter: string) => {
    if (answered || !q || !qd) return;
    setSelected(letter);
    setAnswered(true);
    const isCorrect = letter === q.correct;
    setResults((prev) => [...prev, { id: q.id, question: qd.question, isCorrect }]);

    if (!isCorrect) {
      setLoadingCoach(true);
      // AI coaching will be added via edge function later
      // For now show the explanation from the question data
      setTimeout(() => {
        setCoaching(qd.explanation);
        setLoadingCoach(false);
      }, 800);
    }
  };

  const handleNext = () => {
    if (currentQ + 1 >= tierQuestions.length) {
      setScreen("results");
      return;
    }
    setCurrentQ((p) => p + 1);
    setSelected(null);
    setAnswered(false);
    setCoaching("");
  };

  const handleRestart = () => {
    setResults([]);
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setCoaching("");
    setAgentName("");
    setScreen("start");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {screen === "start" && (
          <div>
            <h1 className="text-2xl sm:text-[27px] font-extrabold text-foreground tracking-tight mb-1.5">
              {t.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-7 leading-relaxed">{t.startDesc}</p>

            <AgentSelector lang={lang} agentName={agentName} onSelect={setAgentName} />

            <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-3 block">
              {t.tierLabel}
            </span>
            <div className="relative mb-6">
              {/* Progress track */}
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-300"
                  style={{ width: tier === "Mid" ? "33%" : tier === "Senior" ? "66%" : "100%" }}
                />
              </div>
              {/* Tier labels */}
              <div className="flex justify-between mt-2.5">
                {TIERS.map((tv, i) => (
                  <button
                    key={tv}
                    className={`text-xs font-semibold transition-all ${
                      tier === tv ? "text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                    }`}
                    onClick={() => setTier(tv)}
                  >
                    {t.tiers[i]}
                  </button>
                ))}
              </div>
              {/* Active dot indicators */}
              <div className="absolute top-0 left-0 right-0 flex justify-between" style={{ transform: "translateY(-25%)" }}>
                {TIERS.map((tv, i) => (
                  <div
                    key={tv}
                    className={`w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer ${
                      TIERS.indexOf(tier) >= i
                        ? "bg-primary border-primary"
                        : "bg-secondary border-border"
                    }`}
                    style={{ marginLeft: i === 0 ? "calc(33% - 7px)" : i === 1 ? "0" : "0", position: "absolute", left: i === 0 ? "calc(33% - 7px)" : i === 1 ? "calc(66% - 7px)" : "calc(100% - 7px)" }}
                    onClick={() => setTier(tv)}
                  />
                ))}
              </div>
            </div>

            {/* Admin access toggle */}
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
              {tierQuestions.length} {t.questions} · {t.passThreshold}
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

        {screen === "quiz" && q && qd && (
          <QuizQuestionView
            question={q}
            lang={lang}
            agentName={agentName}
            currentIndex={currentQ}
            totalQuestions={tierQuestions.length}
            selected={selected}
            answered={answered}
            coaching={coaching}
            loadingCoach={loadingCoach}
            onSelect={handleSelect}
            onNext={handleNext}
            isLast={currentQ + 1 >= tierQuestions.length}
          />
        )}

        {screen === "results" && (
          <QuizResults
            lang={lang}
            agentName={agentName}
            tier={tier}
            results={results}
            totalQuestions={tierQuestions.length}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
