import { Lang } from "@/lib/i18n";
import ldkLogo from "@/assets/logo-ldk.jpeg";

interface QuizHeaderProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  subtitle: string;
}

export function QuizHeader({ lang, onLangChange, subtitle }: QuizHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <img
          src={ldkLogo}
          alt="LDK Logo"
          className="w-10 h-10 rounded-lg object-cover"
        />
        <div>
          <div className="text-sm font-bold text-foreground leading-tight">LDK Sales</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="flex bg-secondary rounded-lg p-0.5 gap-0.5">
        <button
          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
            lang === "en"
              ? "bg-primary/15 border border-primary/30 text-primary"
              : "text-muted-foreground border border-transparent"
          }`}
          onClick={() => onLangChange("en")}
        >
          EN
        </button>
        <button
          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
            lang === "es"
              ? "bg-primary/15 border border-primary/30 text-primary"
              : "text-muted-foreground border border-transparent"
          }`}
          onClick={() => onLangChange("es")}
        >
          ES
        </button>
      </div>
    </div>
  );
}
