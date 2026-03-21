import { describe, it, expect, beforeEach } from "vitest";
import {
  saveAnswer,
  getAgentProgress,
  getProgressPercent,
  getUnansweredIds,
  getSessionQuestions,
  TOTAL_QUESTIONS,
  CERT_THRESHOLD,
} from "@/lib/progress";
import { isEmailValid, register, login, getCurrentSession, logout } from "@/lib/auth";

// Clear localStorage before each test for isolation
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// SCENARIO 1: Agent scores ~50% — no certification
// ---------------------------------------------------------------------------
describe("Scenario 1: Agent scores 50% (fails certification)", () => {
  const key = "agent50@ldk.lat";
  const allIds = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => `q${i + 1}`);

  it("is not certified after answering 27/55 correctly (~49%)", () => {
    // Answer 27 correct, 28 wrong
    for (let i = 0; i < 27; i++) saveAnswer(key, `q${i + 1}`, true);
    for (let i = 27; i < 55; i++) saveAnswer(key, `q${i + 1}`, false);

    const prog = getAgentProgress(key);
    expect(prog.correct.length).toBe(27);
    expect(prog.wrong.length).toBe(28);
    expect(prog.certified).toBe(false);
  });

  it("shows progress < 90%", () => {
    for (let i = 0; i < 27; i++) saveAnswer(key, `q${i + 1}`, true);
    expect(getProgressPercent(key)).toBeLessThan(90);
  });

  it("still has unanswered questions = 0 (all answered)", () => {
    for (let i = 0; i < 27; i++) saveAnswer(key, `q${i + 1}`, true);
    for (let i = 27; i < 55; i++) saveAnswer(key, `q${i + 1}`, false);
    const unanswered = getUnansweredIds(key, allIds);
    expect(unanswered.length).toBe(0);
  });

  it("wrong answers are not overwritten by another wrong attempt", () => {
    saveAnswer(key, "q1", false);
    saveAnswer(key, "q1", false); // duplicate wrong
    const prog = getAgentProgress(key);
    expect(prog.wrong.filter((id) => id === "q1").length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 2: Agent scores 90%+ — earns certification
// ---------------------------------------------------------------------------
describe("Scenario 2: Agent scores 90%+ (earns certification)", () => {
  const key = "agent90@ldk.lat";
  const threshold = Math.ceil(TOTAL_QUESTIONS * CERT_THRESHOLD); // 50

  it("is certified exactly at the threshold (50/55 correct)", () => {
    for (let i = 0; i < threshold; i++) saveAnswer(key, `q${i + 1}`, true);
    const prog = getAgentProgress(key);
    expect(prog.certified).toBe(true);
    expect(prog.correct.length).toBe(threshold);
  });

  it("is certified with a perfect score (55/55)", () => {
    for (let i = 0; i < 55; i++) saveAnswer(key, `q${i + 1}`, true);
    const prog = getAgentProgress(key);
    expect(prog.certified).toBe(true);
    expect(prog.correct.length).toBe(55);
  });

  it("is NOT certified one question below threshold (49/55)", () => {
    for (let i = 0; i < threshold - 1; i++) saveAnswer(key, `q${i + 1}`, true);
    const prog = getAgentProgress(key);
    expect(prog.certified).toBe(false);
  });

  it("a previously wrong answer corrected moves to correct list", () => {
    saveAnswer(key, "q1", false);
    saveAnswer(key, "q1", true); // retake — now correct
    const prog = getAgentProgress(key);
    expect(prog.correct).toContain("q1");
    expect(prog.wrong).not.toContain("q1");
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 3: Agent takes a break and resumes where she left off
// ---------------------------------------------------------------------------
describe("Scenario 3: Break and resume after an hour", () => {
  const key = "resume@ldk.lat";
  const allIds = Array.from({ length: TOTAL_QUESTIONS }, (_, i) => `q${i + 1}`);
  const BREAK_KEY = `ldk_break_${key}`;

  it("progress persists in localStorage across simulated page reloads", () => {
    // Answer 10 questions
    for (let i = 0; i < 10; i++) saveAnswer(key, `q${i + 1}`, i % 2 === 0);

    // Simulate re-reading progress (as if page reloaded)
    const prog = getAgentProgress(key);
    expect(prog.correct.length + prog.wrong.length).toBe(10);
  });

  it("unanswered questions exclude already-answered ones after break", () => {
    for (let i = 0; i < 10; i++) saveAnswer(key, `q${i + 1}`, true);
    const unanswered = getUnansweredIds(key, allIds);
    expect(unanswered.length).toBe(45);
    expect(unanswered).not.toContain("q1");
    expect(unanswered).not.toContain("q10");
  });

  it("next session only serves unanswered questions", () => {
    for (let i = 0; i < 40; i++) saveAnswer(key, `q${i + 1}`, true);
    const session = getSessionQuestions(key, allIds, 15);
    // Only 15 remaining unanswered (55-40), so we get all of them
    expect(session.length).toBe(15);
    session.forEach((id) => expect(parseInt(id.slice(1))).toBeGreaterThan(40));
  });

  it("saved break state is readable after simulated 1-hour gap", () => {
    const breakState = {
      section: "A",
      questionIndex: 7,
      answers: { q1: "correct", q2: "wrong" },
      timestamp: Date.now() - 60 * 60 * 1000, // 1 hour ago
    };
    localStorage.setItem(BREAK_KEY, JSON.stringify(breakState));

    const saved = JSON.parse(localStorage.getItem(BREAK_KEY)!);
    expect(saved.questionIndex).toBe(7);
    expect(saved.section).toBe("A");
    expect(Date.now() - saved.timestamp).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 4: Wrong email domain — registration blocked
// ---------------------------------------------------------------------------
describe("Scenario 4: Wrong email domain", () => {
  it("rejects @gmail.com", () => expect(isEmailValid("agent@gmail.com")).toBe(false));
  it("rejects @hotmail.com", () => expect(isEmailValid("agent@hotmail.com")).toBe(false));
  it("rejects empty string", () => expect(isEmailValid("")).toBe(false));
  it("accepts @ldk.lat", () => expect(isEmailValid("agent@ldk.lat")).toBe(true));
  it("accepts uppercase @LDK.LAT (case-insensitive)", () => expect(isEmailValid("AGENT@LDK.LAT")).toBe(true));

  it("register() returns error for non-@ldk.lat email", async () => {
    const result = await register("Ana", "Lopez", "ana@gmail.com", "pass123");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/@ldk\.lat/);
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 5: Duplicate registration
// ---------------------------------------------------------------------------
describe("Scenario 5: Duplicate registration", () => {
  it("second registration with same email fails", async () => {
    await register("Ana", "Lopez", "ana@ldk.lat", "pass123");
    const second = await register("Ana", "Lopez", "ana@ldk.lat", "otherpass");
    expect(second.success).toBe(false);
    expect(second.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 6: Auth — login/logout/session
// ---------------------------------------------------------------------------
describe("Scenario 6: Login, logout, session persistence", () => {
  it("login with wrong password fails", async () => {
    await register("Carlos", "Ruiz", "carlos@ldk.lat", "correctpass");
    const result = await login("carlos@ldk.lat", "wrongpass");
    expect(result.success).toBe(false);
  });

  it("login with correct password succeeds and sets session", async () => {
    await register("Carlos", "Ruiz", "carlos@ldk.lat", "correctpass");
    logout(); // clear session set by register
    const result = await login("carlos@ldk.lat", "correctpass");
    expect(result.success).toBe(true);
    const session = getCurrentSession();
    expect(session?.email).toBe("carlos@ldk.lat");
    expect(session?.firstName).toBe("Carlos");
  });

  it("logout clears the session", async () => {
    await register("Carlos", "Ruiz", "carlos@ldk.lat", "correctpass");
    logout();
    expect(getCurrentSession()).toBeNull();
  });

  it("login with unknown email fails", async () => {
    const result = await login("nobody@ldk.lat", "pass123");
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 7: LocalStorage cleared mid-session
// ---------------------------------------------------------------------------
describe("Scenario 7: localStorage cleared unexpectedly", () => {
  it("getAgentProgress returns empty state (no crash)", () => {
    localStorage.clear();
    const prog = getAgentProgress("anyone@ldk.lat");
    expect(prog.correct).toEqual([]);
    expect(prog.wrong).toEqual([]);
    expect(prog.certified).toBe(false);
  });

  it("getCurrentSession returns null after clear (no crash)", () => {
    localStorage.clear();
    expect(getCurrentSession()).toBeNull();
  });

  it("saveAnswer works on empty storage without crashing", () => {
    localStorage.clear();
    expect(() => saveAnswer("test@ldk.lat", "q1", true)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 8: Multiple users on same device — progress isolation
// ---------------------------------------------------------------------------
describe("Scenario 8: Multiple users — progress isolation", () => {
  it("user A and user B have independent progress", () => {
    for (let i = 0; i < 50; i++) saveAnswer("userA@ldk.lat", `q${i + 1}`, true);
    for (let i = 0; i < 5; i++) saveAnswer("userB@ldk.lat", `q${i + 1}`, true);

    expect(getAgentProgress("userA@ldk.lat").correct.length).toBe(50);
    expect(getAgentProgress("userB@ldk.lat").correct.length).toBe(5);
    expect(getAgentProgress("userA@ldk.lat").certified).toBe(true);
    expect(getAgentProgress("userB@ldk.lat").certified).toBe(false);
  });
});
