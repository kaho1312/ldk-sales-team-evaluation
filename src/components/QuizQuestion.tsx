import { QuizQuestion as QuizQuestionType } from "@/lib/questions";
import { LANG, Lang } from "@/lib/i18n";

const LETTERS = ["A", "B", "C", "D"];

interface QuizQuestionProps {
  question: QuizQuestionType;
  lang: Lang;
  agentName: string;
  currentIndex: number;
  totalQuestions: number;
  selected: string | null;
  answered: boolean;
  coaching: string;
  loadingCoach: boolean;
  onSelect: (letter: string) => void;
  onNext: () => void;
  isLast: boolean;
}

export function QuizQuestionView({
  question,
  lang,
  agentName,
  currentIndex,
  totalQuestions,
  selected,
  answered,
  coaching,
  loadingCoach,
  onSelect,
  onNext,
  isLast,
}: QuizQuestionProps) {
  const t = LANG[lang];
  const qd = question[lang];
  const progress = ((currentIndex + (answered ? 1 : 0)) / totalQuestions) * 100;

  const getOptionClass = (letter: string) => {
    if (!answered) {
      return selected === letter
        ? "bg-primary/10 border-primary/30"
        : "bg-secondary/40 border-border hover:bg-secondary/70 hover:border-muted-foreground/20 cursor-pointer";
    }
    if (letter === question.correct) return "bg-success/10 border-success/30";
    if (letter === selected) return "bg-destructive/10 border-destructive/30";
    return "bg-secondary/40 border-border opacity-60";
  };

  const getLabelClass = (letter: string) => {
    if (!answered) return selected === letter ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground";
    if (letter === question.correct) return "bg-success/20 text-success";
    if (letter === selected) return "bg-destructive/20 text-destructive";
    return "bg-secondary text-muted-foreground";
  };

  const getTextClass = (letter: string) => {
    if (!answered) return selected === letter ? "text-primary" : "text-muted-foreground";
    if (letter === question.correct) return "text-success";
    if (letter === selected) return "text-destructive";
    return "text-muted-foreground";
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
          className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-400"
          style={{ width: `${progress}%` }}
        />
      </div>

      <h2 className="text-foreground text-[17px] font-semibold leading-relaxed mb-5 tracking-tight">
        {qd.question}
      </h2>

      <div className="flex flex-col gap-2.5 mb-4">
        {qd.options.map((opt, i) => {
          const letter = LETTERS[i];
          return (
            <button
              key={letter}
              className={`flex items-center gap-3 rounded-xl py-3 px-3.5 text-left w-full transition-all border ${getOptionClass(letter)} ${
                answered ? "cursor-default" : ""
              }`}
              onClick={() => !answered && onSelect(letter)}
              disabled={answered}
            >
              <span className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[11px] font-extrabold tracking-wide ${getLabelClass(letter)}`}>
                {letter}
              </span>
              <span className={`text-sm leading-snug ${getTextClass(letter)}`}>{opt}</span>
            </button>
          );
        })}
      </div>

      {answered && !loadingCoach && selected === question.correct && (
        <div className="bg-success/5 border border-success/15 rounded-xl p-3.5 mt-1">
          <div className="text-[11px] font-bold tracking-wider uppercase text-success mb-1.5">{t.correct}</div>
        </div>
      )}

      {answered && loadingCoach && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 mt-1">
          <div className="text-[11px] font-bold tracking-wider uppercase text-primary mb-1.5">{t.coaching}</div>
          <div className="text-sm text-primary/50 italic">{t.loadingCoach}</div>
        </div>
      )}

      {answered && !loadingCoach && coaching && (
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 mt-1">
          <div className="text-[11px] font-bold tracking-wider uppercase text-primary mb-1.5">{t.coaching}</div>
          <div className="text-sm text-muted-foreground leading-relaxed">{coaching}</div>
        </div>
      )}

      {answered && !loadingCoach && (
        <div className="mt-5">
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
