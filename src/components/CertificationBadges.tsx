import badgeJunior from "@/assets/badge-junior-transparent.png.png";
import badgeMidLevel from "@/assets/badge-midlevel-transparent.png.png";
import badgeSenior from "@/assets/badge-senior-transparent.png.png";

interface CertificationBadgesProps {
  earnedTiers: Set<string>;
  lang: "en" | "es";
}

const TIERS = [
  { id: "Junior",    label: "Junior",    img: badgeJunior,   glow: "#30bdff" },
  { id: "Mid-Level", label: "Mid-Level", img: badgeMidLevel, glow: "#30bdff" },
  { id: "Senior",    label: "Senior",    img: badgeSenior,   glow: "#30bdff" },
];

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
                    borderColor: tier.glow + "55",
                    background: `radial-gradient(ellipse at center, ${tier.glow}18 0%, transparent 70%)`,
                    boxShadow: `0 0 16px 3px ${tier.glow}44`,
                  }
                : {
                    borderColor: "#2a2a2a",
                    background: "transparent",
                  }
            }
          >
            {/* Badge image */}
            <div className="relative w-16 h-16 mb-1.5">
              <img
                src={tier.img}
                alt={tier.label}
                className="w-full h-full object-contain transition-all duration-500"
                style={
                  earned
                    ? { filter: "none", opacity: 1 }
                    : { filter: "grayscale(100%) brightness(0.25)", opacity: 0.6 }
                }
              />
              {/* Lock overlay when not earned */}
              {!earned && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="#555"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="9" width="12" height="8" rx="2" />
                    <path d="M7 9V6a3 3 0 016 0v3" />
                  </svg>
                </div>
              )}
            </div>

            {/* Label */}
            <span
              className="text-[10px] font-bold tracking-wide uppercase text-center leading-tight"
              style={{ color: earned ? tier.glow : "#444" }}
            >
              {tier.label}
            </span>
            <span
              className="text-[9px] mt-0.5 text-center"
              style={{ color: earned ? tier.glow + "aa" : "#333" }}
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
