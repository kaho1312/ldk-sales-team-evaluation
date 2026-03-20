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
  TIER_CONFIG,
  Section,
  getByTierAndSection,
  getSectionCounts,
} from "@/lib/questions";

import { getAgentProgress, saveAnswer, getProgressPercent } from "@/lib/progress";

// ── localStorage keys ────────────────────────────────────────────────────────
const EARNED_TIER_KEY = (name: string) => `ldk_earned_tier_${name}`;
const SHEET_URL_KEY = "ldk_quiz_sheet_url";

function getEarnedTier(name: string): string | null {
  return localStorage.getItem(EARNED_TIER_KEY(name));
}

function saveEarnedTier(name: string, tier: string) {
  localStorage.setItem(EARNED_TIER_KEY(name), tier);
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
  const [lang, setLang] = useState<Lang>("es");
  const [screen, setScreen] = useState<"start" | "section" | "quiz" | "results" | "leaderboard">("start");
  const [agentName, setAgentName] = useState("");
  const [earnedTier, setEarnedTier] = useState<string | null>(null);
  const [justEarned, setJustEarned] = useState(false);

  // Section selection
  const [selectedSection, setSelectedSection] = useState<Section>("A");

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

  const t = LANG[lang];

  // Questions for current section
  const sessionQuestions = useMemo(
    () => getByTierAndSection(allQuestions, "Junior", selectedSection),
    [allQuestions, selectedSection],
  );

  const sectionCounts = useMemo(() => getSectionCounts(allQuestions, "Junior"), [allQuestions]);

  const q = sessionQuestions[currentQ];

  // ── Agent selection ──────────────────────────────────────────────────────
  const handleAgentSelect = (name: string) => {
    setAgentName(name);
    setEarnedTier(getEarnedTier(name));
    setJustEarned(false);
  };

  // ── Section selection → start quiz ──────────────────────────────────────
  const handleSectionStart = (section: Section) => {
    setSelectedSection(section);
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
      setFeedback(data.feedback || "");
      setCorrectAnswer(!correct && data.correct_answer ? data.correct_answer : "");
      setGraded(true);
      setGrading(false);

      saveAnswer(agentName, q.id, correct);
      setSessionResults((prev) => [...prev, { id: q.id, question: q.question, isCorrect: correct }]);
    } catch (err: any) {
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
      // Check if passed and award tier
      const correctCount = sessionResults.filter((r) => r.isCorrect).length + (isCorrect ? 1 : 0);
      const score = Math.round((correctCount / sessionQuestions.length) * 100);

      if (score >= 90 && !earnedTier) {
        saveEarnedTier(agentName, "Junior");
        setEarnedTier("Junior");
        setJustEarned(true);
      }

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
    setAgentName("");
    setEarnedTier(null);
    setJustEarned(false);
    setScreen("start");
  };

  const progressPercent = agentName ? getProgressPercent(agentName) : 0;
  const agentProgress = agentName ? getAgentProgress(agentName) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background flex items-center justify-center p-4 sm:p-6">
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 sm:p-9 w-full max-w-[560px] backdrop-blur-sm">
        <QuizHeader lang={lang} onLangChange={setLang} />

        {/* ── Title + tabs (start / leaderboard) ── */}
        {(screen === "start" || screen === "leaderboard" || screen === "section") && (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-[27px] font-extrabold text-foreground tracking-tight mb-1.5">{t.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">{t.startDesc}</p>
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
            <AgentSelector lang={lang} agentName={agentName} onSelect={handleAgentSelect} />

            {/* Earned tier badge */}
            {agentName && earnedTier && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold">
                  {lang === "es" ? "Nivel alcanzado" : "Achieved tier"}
                </span>
                <TierBadge tier={earnedTier} />
              </div>
            )}

            {/* Progress bar */}
            {agentName && (
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
            )}

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
              className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-[15px] font-bold py-3.5 tracking-wide hover:brightness-110 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              onClick={() => agentName && setScreen("section")}
              disabled={!agentName}
            >
              {lang === "es" ? "Seleccionar Sección →" : "Select Section →"}
            </button>
          </div>
        )}

        {/* ── SECTION PICKER ── */}
        {screen === "section" && (
          <div>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base font-bold text-foreground">{agentName}</span>
                {earnedTier && <TierBadge tier={earnedTier} />}
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === "es" ? "Elige una sección para comenzar" : "Choose a section to begin"}
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-6">
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
                    onClick={() => handleSectionStart(sec)}
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

        {/* ── RESULTS SCREEN ── */}
        {screen === "results" && (
          <QuizResults
            lang={lang}
            agentName={agentName}
            earnedTier={earnedTier}
            section={selectedSection}
            results={sessionResults}
            totalQuestions={sessionQuestions.length || sessionResults.length}
            justEarned={justEarned}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
