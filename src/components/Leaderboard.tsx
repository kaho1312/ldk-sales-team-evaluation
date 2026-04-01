import { useState, useEffect } from "react";
import { Lang } from "@/lib/i18n";
import { getLeaderboardData } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/api";

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
    loading: "Loading...",
    empty: "No registered users yet.",
  },
  es: {
    title: "Clasificación",
    progress: "Progreso",
    certified: "Certificada",
    notCertified: "En Progreso",
    loading: "Cargando...",
    empty: "Aún no hay usuarios registrados.",
  },
};

export function Leaderboard({ lang }: LeaderboardProps) {
  const lb = LABELS[lang];
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboardData()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">{lb.loading}</div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-foreground mb-5 tracking-tight">{lb.title}</h2>
      {entries.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">{lb.empty}</div>
      )}
      <div className="flex flex-col gap-2.5">
        {entries.map((entry, i) => {
          const percent = Math.round((entry.correct / entry.total) * 100);
          return (
            <div
              key={entry.id}
              className="flex items-center gap-3 bg-secondary/40 border border-border rounded-xl py-3 px-3.5 transition-all"
            >
              <div className="w-7 text-center text-[11px] font-bold text-muted-foreground/50 tabular-nums shrink-0">
                {i + 1}
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary tracking-wide shrink-0">
                {getInitials(entry.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{entry.full_name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        entry.certified
                          ? "bg-success"
                          : "bg-gradient-to-r from-primary/60 to-primary"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-8 text-right">
                    {entry.correct}/{entry.total}
                  </span>
                </div>
              </div>
              <div
                className={`text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded-lg shrink-0 ${
                  entry.certified
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-secondary text-muted-foreground/50 border border-border"
                }`}
              >
                {entry.certified ? lb.certified : lb.notCertified}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
