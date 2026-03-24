const PROGRESS_KEY = "ldk_agent_progress";
const USERS_KEY = "ldk_users";
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

export function getAgentProgress(key: string): AgentProgress {
  const all = getAll();
  return all[key] || { correct: [], wrong: [], certified: false };
}

export function saveAnswer(key: string, questionId: string, isCorrect: boolean) {
  const all = getAll();
  const prog = all[key] || { correct: [], wrong: [], certified: false };

  if (isCorrect && !prog.correct.includes(questionId)) {
    prog.correct.push(questionId);
    // Remove from wrong if it was there
    prog.wrong = prog.wrong.filter((id) => id !== questionId);
  } else if (!isCorrect && !prog.wrong.includes(questionId) && !prog.correct.includes(questionId)) {
    prog.wrong.push(questionId);
  }

  // Check certification — threshold is floor(total × 0.9), e.g. 49 out of 55
  prog.certified = prog.correct.length >= Math.floor(TOTAL_QUESTIONS * CERT_THRESHOLD);

  all[key] = prog;
  saveAll(all);
}

export function getUnansweredIds(key: string, allIds: string[]): string[] {
  const prog = getAgentProgress(key);
  const answered = new Set([...prog.correct, ...prog.wrong]);
  return allIds.filter((id) => !answered.has(id));
}

export function getSessionQuestions(key: string, allIds: string[], count = 15): string[] {
  const unanswered = getUnansweredIds(key, allIds);
  const shuffled = [...unanswered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getProgressPercent(key: string): number {
  const prog = getAgentProgress(key);
  return Math.round((prog.correct.length / TOTAL_QUESTIONS) * 100);
}

interface RegisteredUser {
  firstName: string;
  lastName: string;
  email: string;
}

export function getLeaderboard(): { name: string; email: string; percent: number; certified: boolean }[] {
  const all = getAll();

  // Load registered users
  let registeredUsers: RegisteredUser[] = [];
  try {
    const usersRaw = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    registeredUsers = Object.values(usersRaw) as RegisteredUser[];
  } catch {
    registeredUsers = [];
  }

  return registeredUsers
    .map((user) => {
      const prog = all[user.email] || { correct: [], wrong: [], certified: false };
      return {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        percent: Math.round((prog.correct.length / TOTAL_QUESTIONS) * 100),
        certified: prog.certified,
      };
    })
    .sort((a, b) => b.percent - a.percent);
}

/** Returns the minimum correct answers needed to certify for a given total. */
export function getCertThreshold(total: number): number {
  return Math.floor(total * CERT_THRESHOLD);
}

export { TOTAL_QUESTIONS, CERT_THRESHOLD };
