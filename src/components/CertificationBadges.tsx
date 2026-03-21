// CertificationBadges — shows 3 motivational badge placeholders.
// Earned badges glow and show the full badge design; locked ones are dim outlines.

interface CertificationBadgesProps {
  earnedTiers: Set<string>;
  lang: "en" | "es";
}

const TIERS = [
  {
    id: "Junior",
    label: "Junior",
    stars: 1,
    color: "#4fc3f7",
    glow: "#30bdff",
    icon: (
      // Chat bubble with check
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <polyline points="9,12 13,16 19,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19 L8 23 L14 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
  },
  {
    id: "Mid-Level",
    label: "Mid-Level",
    stars: 3,
    color: "#29b6f6",
    glow: "#30bdff",
    icon: (
      // Bar chart with upward arrow
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="5" y="16" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="12" y="11" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="19" y="6" width="4" height="17" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 8 L16 4 L21 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "Senior",
    label: "Senior",
    stars: 4,
    color: "#0288d1",
    glow: "#30bdff",
    icon: (
      // Crown
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M4 20 L6 10 L11 16 L14 7 L17 16 L22 10 L24 20 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
        <rect x="4" y="20" width="20" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
];

function Stars({ count, earned }: { count: number; earned: boolean }) {
  return (
    <div className="flex gap-0.5 justify-center mb-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 12 12" fill={earned ? "#f9ca24" : "none"} stroke={earned ? "#f9ca24" : "#555"} strokeWidth="1.2">
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9,11 6,9.5 3,11 3.5,7.5 1,5 4.5,4.5" />
        </svg>
      ))}
    </div>
  );
}

export function CertificationBadges({ earnedTiers, lang }: CertificationBadgesProps) {
  return (
    <div className="flex gap-2 mt-3">
      {TIERS.map((tier) => {
        const earned = earnedTiers.has(tier.id);
        return (
          <div
            key={tier.id}
            className="flex-1 flex flex-col items-center py-3 px-1 rounded-xl border transition-all duration-500"
            style={
              earned
                ? {
                    borderColor: tier.glow + "66",
                    background: `radial-gradient(ellipse at center, ${tier.glow}18 0%, transparent 70%)`,
                    boxShadow: `0 0 14px 2px ${tier.glow}44`,
                  }
                : {
                    borderColor: "#333",
                    background: "transparent",
                    opacity: 0.45,
                  }
            }
          >
            {/* Badge icon circle */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-1.5 border-2"
              style={
                earned
                  ? { color: tier.color, borderColor: tier.color + "88", background: tier.color + "18" }
                  : { color: "#555", borderColor: "#333", background: "transparent", borderStyle: "dashed" }
              }
            >
              {earned ? (
                tier.icon
              ) : (
                // Lock icon when not earned
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="9" width="12" height="8" rx="2" />
                  <path d="M7 9V6a3 3 0 016 0v3" />
                </svg>
              )}
            </div>

            {/* Stars */}
            <Stars count={tier.stars} earned={earned} />

            {/* Label */}
            <span
              className="text-[10px] font-bold tracking-wide uppercase text-center leading-tight"
              style={{ color: earned ? tier.color : "#555" }}
            >
              {tier.label}
            </span>
            <span
              className="text-[9px] mt-0.5 text-center"
              style={{ color: earned ? tier.color + "aa" : "#444" }}
            >
              {earned
                ? lang === "es" ? "Certificada" : "Certified"
                : lang === "es" ? "Bloqueado" : "Locked"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
