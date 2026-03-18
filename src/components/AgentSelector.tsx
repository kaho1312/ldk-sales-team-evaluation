import { useState } from "react";
import { LANG, Lang, PRESET_AGENTS } from "@/lib/i18n";

interface AgentSelectorProps {
  lang: Lang;
  agentName: string;
  onSelect: (name: string) => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AgentSelector({ lang, agentName, onSelect }: AgentSelectorProps) {
  const t = LANG[lang];
  const [ddOpen, setDdOpen] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [agentList, setAgentList] = useState(PRESET_AGENTS);

  const handleAddNew = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!agentList.includes(trimmed)) setAgentList((prev) => [...prev, trimmed]);
    onSelect(trimmed);
    setAddingNew(false);
    setNewName("");
  };

  return (
    <div className="mb-4">
      <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2.5 block">
        {t.selectAgent}
      </span>

      {addingNew ? (
        <div className="mb-5">
          <button
            className="text-primary/60 text-xs font-semibold mb-3.5 block hover:text-primary transition-colors"
            onClick={() => { setAddingNew(false); setNewName(""); }}
          >
            {t.newNameBack}
          </button>
          <span className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2 block">
            {t.newNameLabel}
          </span>
          <div className="flex gap-2 mt-2">
            <input
              className="flex-1 bg-secondary/50 border border-border rounded-lg text-foreground text-sm py-2.5 px-3.5 outline-none focus:border-primary/40 placeholder:text-muted-foreground/40 transition-colors"
              placeholder={t.newNamePlaceholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
              autoFocus
            />
            <button
              className="bg-primary/15 border border-primary/30 rounded-lg text-primary text-sm font-bold px-4 hover:bg-primary/25 transition-colors disabled:opacity-30"
              onClick={handleAddNew}
              disabled={!newName.trim()}
            >
              ✓
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mb-2.5">
          <button
            className={`w-full bg-secondary/50 border rounded-xl py-3 px-3.5 text-sm font-medium text-left flex items-center gap-2.5 transition-all ${
              ddOpen
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-primary/30 hover:bg-primary/5"
            }`}
            onClick={() => setDdOpen((o) => !o)}
          >
            {agentName ? (
              <>
                <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary tracking-wide shrink-0">
                  {getInitials(agentName)}
                </div>
                <span className="text-foreground font-medium">{agentName}</span>
              </>
            ) : (
              <span className="text-muted-foreground/40">{t.selectPlaceholder}</span>
            )}
            <span className={`absolute right-3.5 text-muted-foreground/30 text-[11px] transition-transform ${ddOpen ? "rotate-180" : ""}`}>
              ▼
            </span>
          </button>

          {ddOpen && (
            <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-popover border border-border rounded-xl overflow-hidden z-50 shadow-lg shadow-black/40">
              {agentList.map((name) => (
                <button
                  key={name}
                  className={`flex items-center gap-2.5 py-2.5 px-3.5 w-full text-left transition-colors hover:bg-primary/10 ${
                    agentName === name ? "bg-primary/10" : ""
                  }`}
                  onClick={() => { onSelect(name); setDdOpen(false); }}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wide shrink-0 ${
                    agentName === name
                      ? "bg-primary/20 border-primary/40 text-primary border"
                      : "bg-primary/12 border-primary/20 text-primary border"
                  }`}>
                    {getInitials(name)}
                  </div>
                  <span className={`text-sm flex-1 ${agentName === name ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    {name}
                  </span>
                  {agentName === name && <span className="text-[11px] text-primary font-extrabold">✓</span>}
                </button>
              ))}
              <div className="h-px bg-border" />
              <button
                className="flex items-center gap-2.5 py-2.5 px-3.5 w-full text-left text-primary/60 text-sm font-semibold hover:bg-primary/5 hover:text-primary transition-all"
                onClick={() => { setDdOpen(false); setAddingNew(true); }}
              >
                <span className="text-base leading-none">+</span>
                {t.addNew}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
