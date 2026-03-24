import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getAgentProgress, TOTAL_QUESTIONS } from "./progress";

// ── Client (null when env vars are absent — allows offline/dev use) ───────────
const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

// ── Row shape ─────────────────────────────────────────────────────────────────
interface LeaderboardRow {
  email:         string;
  first_name:    string;
  last_name:     string;
  correct_count: number;
  certified:     boolean;
  updated_at?:   string;
}

// ── Sync user on registration ─────────────────────────────────────────────────
// Called fire-and-forget from auth.ts after localStorage write.
export async function syncUserToSupabase(
  email: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  if (!supabase) return;
  const prog = getAgentProgress(email);
  const row: LeaderboardRow = {
    email,
    first_name:    firstName,
    last_name:     lastName,
    correct_count: prog.correct.length,
    certified:     prog.certified,
    updated_at:    new Date().toISOString(),
  };
  await supabase.from("leaderboard").upsert(row, { onConflict: "email" });
}

// ── Sync progress after a session ends ───────────────────────────────────────
// Called fire-and-forget from Index.tsx when the results screen is shown.
export async function syncProgressToSupabase(email: string): Promise<void> {
  if (!supabase) return;
  const prog = getAgentProgress(email);
  await supabase
    .from("leaderboard")
    .update({
      correct_count: prog.correct.length,
      certified:     prog.certified,
      updated_at:    new Date().toISOString(),
    })
    .eq("email", email);
}

// ── Fetch shared leaderboard from Supabase ───────────────────────────────────
export interface LeaderboardEntry {
  name:      string;
  email:     string;
  percent:   number;
  certified: boolean;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("leaderboard")
    .select("email, first_name, last_name, correct_count, certified")
    .order("correct_count", { ascending: false });

  if (error || !data) return null;

  return (data as LeaderboardRow[]).map((row) => ({
    name:      `${row.first_name} ${row.last_name}`,
    email:     row.email,
    percent:   Math.round((row.correct_count / TOTAL_QUESTIONS) * 100),
    certified: row.certified,
  }));
}
