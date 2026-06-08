// ─────────────────────────────────────────────────────────────────────────────
// LDK Sales Certification — AWS API Layer (migration target)
// All persistent data operations go through this module.
// ─────────────────────────────────────────────────────────────────────────────

import { calculateScore } from "./scoring";
import type { ScoreResult } from "./scoring";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  created_at: string;
  last_login: string | null;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  certification_tier: string;
  attempt_number: number;
  started_at: string;
  completed_at: string | null;
  status: "in_progress" | "passed" | "failed";
  total_correct: number | null;
  total_questions: number | null;
  section_errors: { A: number; B: number; C: number } | null;
  score_percent: number | null;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  section: string;
  user_answer: string;
  ai_grade: boolean | null;
  ai_reasoning: string | null;
  admin_override: boolean | null;
  final_grade: boolean | null;
  created_at: string;
}

export interface QuizConfig {
  id: string;
  certification_tier: string;
  total_questions: number;
  section_count: number;
  passing_threshold: number;
  questions_source_url: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface Certification {
  id: string;
  user_id: string;
  certification_tier: string;
  attempt_id: string | null;
  granted_at: string;
  granted_by: string;
}

import { getStoredToken } from "./auth";

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function getApiUrl(path: string, query?: Record<string, string | number | boolean>): string {
  if (!apiBaseUrl) {
    throw new Error("VITE_API_URL is not configured.");
  }

  const base = apiBaseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;

  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  return `${url}?${params.toString()}`;
}

async function apiFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | boolean>;
  },
): Promise<T> {
  const url = getApiUrl(path, options?.query);
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = data?.message || response.statusText || "Request failed";
    throw new Error(error);
  }

  return data as T;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  return apiFetch<UserProfile | null>("/me");
}

// ── Quiz attempt lifecycle ────────────────────────────────────────────────────

export async function startAttempt(userId: string, tier: string): Promise<string> {
  const data = await apiFetch<{ id: string }>("/attempts", {
    method: "POST",
    body: { userId, tier },
  });
  return data.id;
}

export async function getActiveAttempt(userId: string, tier: string): Promise<QuizAttempt | null> {
  return apiFetch<QuizAttempt | null>("/attempts/active", {
    query: { userId, tier },
  });
}

export async function getAttemptAnswers(
  attemptId: string,
): Promise<{ question_id: string; section: string; ai_grade: boolean | null }[]> {
  return apiFetch(`/attempts/${attemptId}/answers`);
}

export async function saveAnswerToAttempt(
  attemptId: string,
  questionId: string,
  section: string,
  userAnswer: string,
  aiGrade: boolean,
  aiReasoning: string,
): Promise<void> {
  await apiFetch<void>(`/attempts/${attemptId}/answers`, {
    method: "POST",
    body: {
      questionId,
      section,
      userAnswer,
      aiGrade,
      aiReasoning,
    },
  });
}

export async function completeAttempt(
  attemptId: string,
  config: { total_questions: number; passing_threshold: number },
): Promise<ScoreResult> {
  return apiFetch<ScoreResult>(`/attempts/${attemptId}/complete`, {
    method: "POST",
    body: config,
  });
}

// ── Certifications ────────────────────────────────────────────────────────────

export async function getUserCertifications(userId: string): Promise<Certification[]> {
  return apiFetch<Certification[]>(`/users/${userId}/certifications`);
}

export async function grantCertification(
  userId: string,
  tier: string,
  attemptId: string,
  grantedBy = "system",
): Promise<void> {
  await apiFetch<void>(`/users/${userId}/certifications`, {
    method: "POST",
    body: { tier, attemptId, grantedBy },
  });
}

export async function revokeCertification(userId: string, tier: string): Promise<void> {
  await apiFetch<void>(`/users/${userId}/certifications/${encodeURIComponent(tier)}`, {
    method: "DELETE",
  });
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getUserProgress(
  userId: string,
  tier: string,
): Promise<{ correct: number; total: number; certified: boolean }> {
  return apiFetch<{ correct: number; total: number; certified: boolean }>(
    `/users/${userId}/progress`,
    { query: { tier } },
  );
}

// ── Quiz configs ──────────────────────────────────────────────────────────────

export async function getQuizConfigs(): Promise<QuizConfig[]> {
  return apiFetch<QuizConfig[]>("/quiz-configs");
}

export async function getActiveConfig(tier: string): Promise<QuizConfig | null> {
  return apiFetch<QuizConfig | null>("/quiz-configs/active", {
    query: { tier },
  });
}

export async function updateQuizConfig(
  id: string,
  updates: Partial<Pick<QuizConfig, "total_questions" | "passing_threshold" | "questions_source_url" | "is_active">>,
): Promise<void> {
  await apiFetch<void>(`/quiz-configs/${id}`, {
    method: "PUT",
    body: { ...updates, updated_at: new Date().toISOString() },
  });
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  full_name: string;
  correct: number;
  total: number;
  certified: boolean;
}

export async function getLeaderboardData(): Promise<LeaderboardEntry[]> {
  return apiFetch<LeaderboardEntry[]>("/leaderboard");
}

// ── Completed sections ────────────────────────────────────────────────────────

export async function getSectionProgress(
  userId: string,
  tier: string,
): Promise<{ A: number; B: number; C: number }> {
  return apiFetch<{ A: number; B: number; C: number }>(
    `/users/${userId}/section-progress`,
    { query: { tier } },
  );
}

export async function getCompletedSections(userId: string, tier: string): Promise<Set<string>> {
  const sections = await apiFetch<string[]>(`/users/${userId}/completed-sections`, {
    query: { tier },
  });
  return new Set(sections);
}

// ── Admin — user list ─────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  created_at: string;
  last_login: string | null;
  certifications: { certification_tier: string; granted_at: string }[];
  attempts: QuizAttempt[];
}

export async function adminGetAllUsers(): Promise<AdminUserRow[]> {
  return apiFetch<AdminUserRow[]>("/admin/users");
}

export async function adminSetUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await apiFetch<void>(`/admin/users/${userId}/admin`, {
    method: "PUT",
    body: { isAdmin },
  });
}

// ── Admin — attempt detail with all answers ───────────────────────────────────

export interface AttemptWithAnswers extends QuizAttempt {
  answers: Answer[];
  user: Pick<UserProfile, "email" | "full_name">;
}

export async function adminGetAttemptDetails(attemptId: string): Promise<AttemptWithAnswers | null> {
  return apiFetch<AttemptWithAnswers | null>(`/admin/attempts/${attemptId}`);
}

// ── Admin — override an answer and recalculate ────────────────────────────────

export async function adminOverrideAnswer(
  answerId: string,
  override: boolean | null,
  attemptId: string,
  config: { total_questions: number; passing_threshold: number },
): Promise<ScoreResult> {
  return apiFetch<ScoreResult>(`/admin/answers/${answerId}/override`, {
    method: "POST",
    body: { override, attemptId, config },
  });
}

// ── Admin — CSV export ───────────────────────────────────────────────────────

export async function adminGetAllAttempts(): Promise<
  (QuizAttempt & { user_email: string; user_name: string })[]
> {
  return apiFetch<(QuizAttempt & { user_email: string; user_name: string })[]>("/admin/attempts");
}

export function exportAttemptsToCSV(
  attempts: (QuizAttempt & { user_email: string; user_name: string })[],
): string {
  const headers = [
    "Nombre", "Correo", "Nivel", "Intento #", "Estado",
    "Puntaje %", "Correctas", "Total", "Errores Sec.A", "Errores Sec.B", "Errores Sec.C",
    "Iniciado", "Completado",
  ];
  const esc = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const rows = attempts.map((a) => [
    a.user_name, a.user_email, a.certification_tier, a.attempt_number, a.status,
    a.score_percent ?? "", a.total_correct ?? "", a.total_questions ?? "",
    a.section_errors?.A ?? "", a.section_errors?.B ?? "", a.section_errors?.C ?? "",
    a.started_at, a.completed_at ?? "",
  ]);

  return [headers, ...rows].map((row) => row.map(esc).join(",")).join("\n");
}
