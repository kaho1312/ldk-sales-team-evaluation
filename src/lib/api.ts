// ─────────────────────────────────────────────────────────────────────────────
// LDK Sales Certification — Supabase API Layer
// All persistent data operations go through this module.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";
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

// ── Current user ──────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<UserProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  return (data as UserProfile) ?? null;
}

// ── Quiz attempt lifecycle ────────────────────────────────────────────────────

export async function startAttempt(userId: string, tier: string): Promise<string> {
  // Count prior attempts for this user+tier to derive attempt_number
  const { count } = await supabase
    .from("quiz_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("certification_tier", tier);

  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      certification_tier: tier,
      attempt_number: (count ?? 0) + 1,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function getActiveAttempt(userId: string, tier: string): Promise<QuizAttempt | null> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("certification_tier", tier)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as QuizAttempt) ?? null;
}

export async function saveAnswerToAttempt(
  attemptId: string,
  questionId: string,
  section: string,
  userAnswer: string,
  aiGrade: boolean,
  aiReasoning: string,
): Promise<void> {
  const { error } = await supabase.from("answers").upsert(
    {
      attempt_id: attemptId,
      question_id: questionId,
      section,
      user_answer: userAnswer,
      ai_grade: aiGrade,
      ai_reasoning: aiReasoning,
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw error;
}

export async function completeAttempt(
  attemptId: string,
  config: { total_questions: number; passing_threshold: number },
): Promise<ScoreResult> {
  const { data: answers, error } = await supabase
    .from("answers")
    .select("section, final_grade")
    .eq("attempt_id", attemptId);

  if (error) throw error;

  const result = calculateScore(
    answers ?? [],
    config.total_questions,
    config.passing_threshold,
  );

  await supabase
    .from("quiz_attempts")
    .update({
      status: result.passed ? "passed" : "failed",
      completed_at: new Date().toISOString(),
      total_correct: result.total_correct,
      total_questions: result.total_questions,
      section_errors: result.section_errors,
      score_percent: result.score_percent,
    })
    .eq("id", attemptId);

  return result;
}

// ── Certifications ────────────────────────────────────────────────────────────

export async function getUserCertifications(userId: string): Promise<Certification[]> {
  const { data } = await supabase
    .from("certifications")
    .select("*")
    .eq("user_id", userId);
  return (data ?? []) as Certification[];
}

export async function grantCertification(
  userId: string,
  tier: string,
  attemptId: string,
  grantedBy = "system",
): Promise<void> {
  await supabase.from("certifications").upsert(
    { user_id: userId, certification_tier: tier, attempt_id: attemptId, granted_by: grantedBy },
    { onConflict: "user_id,certification_tier" },
  );
}

export async function revokeCertification(userId: string, tier: string): Promise<void> {
  await supabase
    .from("certifications")
    .delete()
    .eq("user_id", userId)
    .eq("certification_tier", tier);
}

// ── Progress ──────────────────────────────────────────────────────────────────

export async function getUserProgress(
  userId: string,
  tier: string,
): Promise<{ correct: number; total: number; certified: boolean }> {
  const [certResult, configResult, answersResult] = await Promise.all([
    supabase
      .from("certifications")
      .select("id")
      .eq("user_id", userId)
      .eq("certification_tier", tier)
      .maybeSingle(),
    supabase
      .from("quiz_configs")
      .select("total_questions")
      .eq("certification_tier", tier)
      .single(),
    supabase
      .from("answers")
      .select("question_id, final_grade, quiz_attempts!inner(user_id, certification_tier, status)")
      .eq("quiz_attempts.user_id", userId)
      .eq("quiz_attempts.certification_tier", tier)
      .eq("final_grade", true),
  ]);

  const total = configResult.data?.total_questions ?? 55;
  // Deduplicate: a question answered correctly in multiple attempts counts once
  const uniqueCorrect = new Set((answersResult.data ?? []).map((a: { question_id: string }) => a.question_id)).size;

  return {
    correct: uniqueCorrect,
    total,
    certified: !!certResult.data,
  };
}

// ── Quiz configs ──────────────────────────────────────────────────────────────

export async function getQuizConfigs(): Promise<QuizConfig[]> {
  const { data } = await supabase
    .from("quiz_configs")
    .select("*")
    .order("certification_tier");
  return (data ?? []) as QuizConfig[];
}

export async function getActiveConfig(tier: string): Promise<QuizConfig | null> {
  const { data } = await supabase
    .from("quiz_configs")
    .select("*")
    .eq("certification_tier", tier)
    .single();
  return (data as QuizConfig) ?? null;
}

export async function updateQuizConfig(
  id: string,
  updates: Partial<Pick<QuizConfig, "total_questions" | "passing_threshold" | "questions_source_url" | "is_active">>,
): Promise<void> {
  const { error } = await supabase
    .from("quiz_configs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Completed sections ────────────────────────────────────────────────────────

export async function getCompletedSections(userId: string, tier: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("answers")
    .select("section, quiz_attempts!inner(user_id, certification_tier, status)")
    .eq("quiz_attempts.user_id", userId)
    .eq("quiz_attempts.certification_tier", tier)
    .neq("quiz_attempts.status", "in_progress");
  const sections = new Set((data ?? []).map((a: { section: string }) => a.section));
  return sections;
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
  const { data, error } = await supabase
    .from("users")
    .select(`
      id, email, full_name, is_admin, created_at, last_login,
      certifications(certification_tier, granted_at),
      quiz_attempts(id, certification_tier, attempt_number, status, score_percent,
                    total_correct, total_questions, section_errors,
                    started_at, completed_at)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as any[]).map((u) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    is_admin: u.is_admin ?? false,
    created_at: u.created_at,
    last_login: u.last_login,
    certifications: u.certifications ?? [],
    attempts: (u.quiz_attempts ?? []).sort(
      (a: QuizAttempt, b: QuizAttempt) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    ),
  }));
}

export async function adminSetUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase.from("users").update({ is_admin: isAdmin }).eq("id", userId);
  if (error) throw error;
}

// ── Admin — attempt detail with all answers ───────────────────────────────────

export interface AttemptWithAnswers extends QuizAttempt {
  answers: Answer[];
  user: Pick<UserProfile, "email" | "full_name">;
}

export async function adminGetAttemptDetails(attemptId: string): Promise<AttemptWithAnswers | null> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(`
      *,
      answers(*),
      users(email, full_name)
    `)
    .eq("id", attemptId)
    .single();

  if (error || !data) return null;
  return {
    ...(data as any),
    user: (data as any).users,
    answers: ((data as any).answers ?? []).sort((a: Answer, b: Answer) =>
      a.question_id.localeCompare(b.question_id),
    ),
  } as AttemptWithAnswers;
}

// ── Admin — override an answer and recalculate ────────────────────────────────

export async function adminOverrideAnswer(
  answerId: string,
  override: boolean | null,
  attemptId: string,
  config: { total_questions: number; passing_threshold: number },
): Promise<ScoreResult> {
  await supabase
    .from("answers")
    .update({ admin_override: override })
    .eq("id", answerId);

  const { data: answers } = await supabase
    .from("answers")
    .select("section, final_grade")
    .eq("attempt_id", attemptId);

  const result = calculateScore(
    answers ?? [],
    config.total_questions,
    config.passing_threshold,
  );

  await supabase
    .from("quiz_attempts")
    .update({
      status: result.passed ? "passed" : "failed",
      total_correct: result.total_correct,
      section_errors: result.section_errors,
      score_percent: result.score_percent,
    })
    .eq("id", attemptId);

  return result;
}

// ── Admin — CSV export ────────────────────────────────────────────────────────

export async function adminGetAllAttempts(): Promise<
  (QuizAttempt & { user_email: string; user_name: string })[]
> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*, users(email, full_name)")
    .order("started_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as any[]).map((a) => ({
    ...a,
    user_email: a.users?.email ?? "",
    user_name: a.users?.full_name ?? "",
  }));
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
