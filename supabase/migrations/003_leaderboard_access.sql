-- Allow all authenticated users to read team member names for the leaderboard.
-- These are additive SELECT policies — existing write/update policies are unchanged.

CREATE POLICY "users_leaderboard_read" ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "certs_leaderboard_read" ON public.certifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "attempts_leaderboard_read" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (true);
