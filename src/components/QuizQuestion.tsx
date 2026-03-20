import { useState } from "react";
import { QuizQuestion as QuizQuestionType } from "@/lib/questions";
import { LANG, Lang } from "@/lib/i18n";

interface QuizQuestionProps {
  question: QuizQuestionType;
  lang: Lang;
  agentName: string;
  currentIndex: number;
  totalQuestions: number;
  onSubmitAnswer: (answer: string) => void;
  grading: boolean;
  graded: boolean;
  isCorrect: boolean | null;
  feedback: string;
  correctAnswer: string;
  onNext: () => void;
  isLast: boolean;
}

export function QuizQuestionView({
  question,
  lang,
  agentName,
  currentIndex,
  totalQuestions,
  onSubmitAnswer,
  grading,
  graded,
  isCorrect,
  feedback,
  correctAnswer,
  onNext,
  isLast,
}: QuizQuestionProps) {
  const t = LANG[lang];
  const progress = ((currentIndex + (graded ? 1 : 0)) / totalQuestions) * 100;
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (!answer.trim() || grading || graded) return;
    onSubmitAnswer(answer.trim());
  };

  return (
    <div>
      <div className="flex justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {t.question} {currentIndex + 1} {t.of} {totalQuestions}
        </span>
        <span className="text-xs text-primary/60">{agentName.split(" ")[0]}</span>
      </div>

      <div className="h-[3px] bg-secondary rounded-full overflow-hidden mb-7">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="text-foreground text-[17px] font-semibold leading-relaxed mb-5 tracking-tight">
        {question.question}
      </h2>

      {!graded && (
        <div className="mb-4">
          <textarea
            className="w-full bg-secondary/40 border border-border rounded-xl py-3 px-3.5 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 transition-colors resize-none min-h-[120px]"
            placeholder={lang === "es" ? "Escribe tu respuesta aquí..." : "Type your answer here..."}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={grading}
            autoFocus
          />
          <button
            className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-[15px] font-bold py-3.5 tracking-wide hover:brightness-110 transition-all disabled:opacity-20 disabled:cursor-not-allowed mt-3"
            onClick={handleSubmit}
            disabled={!answer.trim() || grading}
          >
            {grading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t.loadingCoach}
              </span>
            ) : lang === "es" ? (
              "Enviar Respuesta"
            ) : (
              "Submit Answer"
            )}
          </button>
        </div>
      )}

      {graded && isCorrect && (
        <div className="bg-success/5 border border-success/15 rounded-xl p-3.5 mt-1 mb-4">
          <div className="text-[11px] font-bold tracking-wider uppercase text-success mb-1.5">{t.correct}</div>
          {feedback && <div className="text-sm text-muted-foreground leading-relaxed">{feedback}</div>}
        </div>
      )}

      {graded && !isCorrect && (
        <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-3.5 mt-1 mb-4">
          <div className="text-[11px] font-bold tracking-wider uppercase text-destructive mb-1.5">
            {lang === "es" ? "Incorrecto" : "Incorrect"}
          </div>
          {feedback && (
            <div className="mt-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
              <div className="text-[11px] font-bold tracking-wider uppercase text-primary mb-1">{t.coaching}</div>
              <div className="text-sm text-muted-foreground leading-relaxed">{feedback}</div>
            </div>
          )}
          {correctAnswer && (
            <div className="mt-2 bg-success/5 border border-success/15 rounded-lg p-3">
              <div className="text-[11px] font-bold tracking-wider uppercase text-success mb-1">
                {lang === "es" ? "Respuesta Correcta" : "Correct Answer"}
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed">{correctAnswer}</div>
            </div>
          )}
        </div>
      )}

      {graded && (
        <div className="mt-4">
          <button
            className="w-full bg-gradient-to-r from-primary to-primary/80 rounded-xl text-primary-foreground text-[15px] font-bold py-3.5 tracking-wide hover:brightness-110 transition-all"
            onClick={onNext}
          >
            {isLast ? t.finish : t.next} →
          </button>
        </div>
      )}
    </div>
  );
}
