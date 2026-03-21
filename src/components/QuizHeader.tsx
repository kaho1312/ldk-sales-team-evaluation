import { Lang } from "@/lib/i18n";
import ldkLogo from "@/assets/logo-ldk.jpeg";

interface QuizHeaderProps {
  lang: Lang;
  onLangChange: (lang: Lang) => void;
}

export function QuizHeader({ lang, onLangChange }: QuizHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        <img
          src={ldkLogo}
          alt="LDK Logo"
          className="w-12 h-12 object-cover shrink-0"
          style={{
            borderRadius: "5px",
            boxShadow: "0 0 12px 3px #30bdff, 0 0 4px 1px #30bdff88",
          }}
        />
        <div className="text-base font-bold text-foreground leading-tight">LDK Sales</div>
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
