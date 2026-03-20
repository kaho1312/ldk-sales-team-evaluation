import { LANG, Lang } from "@/lib/i18n";
import { getLeaderboard } from "@/lib/progress";

interface LeaderboardProps {
  lang: Lang;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const LABELS = {
  en: {
    title: "Leaderboard",
    progress: "Progress",
    certified: "Certified",
    notCertified: "In Progress",
  },
  es: {
    title: "Clasificación",
    progress: "Progreso",
    certified: "Certificada",
    notCertified: "En Progreso",
  },
};

export function Leaderboard({ lang }: LeaderboardProps) {
  const lb = LABELS[lang];
  const agents = getLeaderboard();

  return (
    <div>
      <h2 className="text-lg font-bold text-foreground mb-5 tracking-tight">{lb.title}</h2>
      <div className="flex flex-col gap-2.5">
        {agents.map((agent, i) => (
          <div
            key={agent.name}
            className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl py-3 px-3.5 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary tracking-wide shrink-0">
              {getInitials(agent.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{agent.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      agent.certified
                        ? "bg-success"
                        : "bg-gradient-to-r from-primary/60 to-primary"
                    }`}
                    style={{ width: `${agent.percent}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-8 text-right">
                  {agent.percent}%
                </span>
              </div>
            </div>
            <div
              className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg shrink-0 ${
                agent.certified
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-secondary text-muted-foreground/50 border border-border"
              }`}
            >
              {agent.certified ? lb.certified : lb.notCertified}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
