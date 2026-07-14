-- Mid-Level certification: allow answer sections D/E/F and activate the tier.
--
-- Context: the quiz was Junior-only (3 sections A/B/C). Mid-Level has 6 sections
-- (A–F, 60 questions). The `answers.section` CHECK constraint from migration 001
-- only permits A/B/C/All, so ANY Mid-Level answer in D/E/F fails to INSERT until
-- this runs. Run this BEFORE deploying the Mid-Level Lambda + frontend, or early
-- takers silently lose their D/E/F answers.
--
-- Idempotent-ish: safe to run once. If re-run, the DROP CHECK will error because
-- the constraint no longer exists by that name — that's fine, ignore it.
USE ldk_quiz;

-- 1) Relax the section CHECK to include D, E, F (MySQL 8.0.16+ supports named CHECKs).
ALTER TABLE answers DROP CHECK chk_answer_section;
ALTER TABLE answers ADD CONSTRAINT chk_answer_section
  CHECK (section IN ('A','B','C','D','E','F','All'));

-- 2) Activate the Mid-Level tier config (60 questions, 6 sections, 90% threshold).
--    The row is seeded by migration 001 at total_questions=0, is_active=0.
UPDATE quiz_configs
   SET total_questions = 60,
       section_count   = 6,
       passing_threshold = 0.9000,
       is_active       = 1
 WHERE certification_tier = 'mid-level';

-- Note: quiz_attempts.chk_attempt_tier and certifications.chk_cert_tier already
-- permit 'mid-level' (migration 001) — no change needed there.

-- Verify:
--   SELECT certification_tier, total_questions, section_count, is_active
--     FROM quiz_configs WHERE certification_tier = 'mid-level';
--   -- expect: mid-level | 60 | 6 | 1
