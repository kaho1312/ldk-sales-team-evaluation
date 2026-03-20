import { PRESET_AGENTS } from "@/lib/i18n";

const PROGRESS_KEY = "ldk_agent_progress";
const TOTAL_QUESTIONS = 55;
const CERT_THRESHOLD = 0.9;

export interface AgentProgress {
  correct: string[];   // question IDs answered correctly
  wrong: string[];     // question IDs answered wrong (stay wrong until retake)
  certified: boolean;
}

function getAll(): Record<string, AgentProgress> {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, AgentProgress>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

export function getAgentProgress(name: string): AgentProgress {
  const all = getAll();
  return all[name] || { correct: [], wrong: [], certified: false };
}

export function saveAnswer(name: string, questionId: string, isCorrect: boolean) {
  const all = getAll();
  const prog = all[name] || { correct: [], wrong: [], certified: false };

  if (isCorrect && !prog.correct.includes(questionId)) {
    prog.correct.push(questionId);
    // Remove from wrong if it was there
    prog.wrong = prog.wrong.filter((id) => id !== questionId);
  } else if (!isCorrect && !prog.wrong.includes(questionId) && !prog.correct.includes(questionId)) {
    prog.wrong.push(questionId);
  }

  // Check certification
  prog.certified = prog.correct.length >= Math.ceil(TOTAL_QUESTIONS * CERT_THRESHOLD);

  all[name] = prog;
  saveAll(all);
}

export function getUnansweredIds(name: string, allIds: string[]): string[] {
  const prog = getAgentProgress(name);
  const answered = new Set([...prog.correct, ...prog.wrong]);
  return allIds.filter((id) => !answered.has(id));
}

export function getSessionQuestions(name: string, allIds: string[], count = 15): string[] {
  const unanswered = getUnansweredIds(name, allIds);
  // Shuffle and pick up to count
  const shuffled = [...unanswered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getProgressPercent(name: string): number {
  const prog = getAgentProgress(name);
  return Math.round((prog.correct.length / TOTAL_QUESTIONS) * 100);
}

export function getLeaderboard(): { name: string; percent: number; certified: boolean }[] {
  const all = getAll();
  return PRESET_AGENTS.map((name) => {
    const prog = all[name] || { correct: [], wrong: [], certified: false };
    return {
      name,
      percent: Math.round((prog.correct.length / TOTAL_QUESTIONS) * 100),
      certified: prog.certified,
    };
  }).sort((a, b) => b.percent - a.percent);
}

export { TOTAL_QUESTIONS, CERT_THRESHOLD };
