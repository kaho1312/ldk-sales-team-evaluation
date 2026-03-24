import { useEffect, useState } from "react";
import { LANG, Lang } from "@/lib/i18n";
import { fetchLeaderboard, LeaderboardEntry } from "@/lib/supabase";
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
    loading: "Loading rankings…",
    empty: "No registered users yet.",
    offline: "Showing local data — leaderboard not connected.",
  },
  es: {
    title: "Clasificación",
    progress: "Progreso",
    certified: "Certificada",
    notCertified: "En Progreso",
    loading: "Cargando clasificación…",
    empty: "Aún no hay usuarios registrados.",
    offline: "Mostrando datos locales — leaderboard no conectado.",
  },
};

export function Leaderboard({ lang }: LeaderboardProps) {
  const lb = LABELS[lang];

  const [agents, setAgents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchLeaderboard().then((data) => {
      if (cancelled) return;
      if (data !== null) {
        setAgents(data);
        setIsLocal(false);
      } else {
        // Supabase not configured or unavailable — fall back to localStorage
        setAgents(getLeaderboard());
        setIsLocal(true);
      }
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setAgents(getLeaderboard());
      setIsLocal(true);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h2 className="text-lg font-bold text-foreground mb-5 tracking-tight">{lb.title}</h2>

      {/* Offline / local-data notice */}
      {!loading && isLocal && (
        <div className="text-[11px] text-muted-foreground/50 text-center mb-4 border border-border/40 rounded-lg py-2 px-3">
          {lb.offline}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-secondary/20 border border-border/30 rounded-xl py-3 px-3.5 animate-pulse"
            >
              <div className="w-8 h-8 rounded-full bg-secondary/60 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-secondary/60 rounded w-2/3" />
                <div className="h-1.5 bg-secondary/40 rounded w-full" />
              </div>
              <div className="w-16 h-5 bg-secondary/40 rounded-lg shrink-0" />
            </div>
          ))}
        </div>
      )}

      {!loading && agents.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">{lb.empty}</div>
      )}

      {!loading && agents.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {agents.map((agent, i) => (
            <div
              key={agent.email}
              className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl py-3 px-3.5 transition-all"
            >
              {/* Rank badge */}
              <div className="w-5 text-center text-[11px] font-bold text-muted-foreground/40 tabular-nums shrink-0">
                {i + 1}
              </div>

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
      )}
    </div>
  );
}
