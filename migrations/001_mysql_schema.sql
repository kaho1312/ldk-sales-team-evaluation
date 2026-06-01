-- ─────────────────────────────────────────────────────────────────────────────
-- LDK Sales Certification — MySQL 8 Schema
-- Translated from supabase/migrations/001_initial_schema.sql (Postgres/Supabase)
-- Run against RDS MySQL 8.0.x after provisioning the instance.
--
-- Key differences from the Postgres version:
--   • No auth.users FK — user IDs are Cognito sub UUIDs (CHAR(36))
--   • No RLS — access control is enforced at the Lambda layer
--   • No Supabase trigger — the /me endpoint creates the users row on first login
--   • DEFAULT (UUID()) requires MySQL 8.0.13+
--   • TINYINT(1) is used for booleans (0 = false, 1 = true)
--   • generated always as ... stored is supported in MySQL 8
-- ─────────────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS ldk_quiz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ldk_quiz;

-- ── users ────────────────────────────────────────────────────────────────────
-- id = Cognito sub (UUID string); row created by POST /me on first login
CREATE TABLE IF NOT EXISTS users (
  id          CHAR(36)     NOT NULL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  full_name   VARCHAR(255) NOT NULL,
  is_admin    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login  DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── quiz_configs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_configs (
  id                   CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  certification_tier   VARCHAR(50)   NOT NULL,
  total_questions      INT           NOT NULL DEFAULT 0,
  section_count        INT           NOT NULL DEFAULT 3,
  passing_threshold    DECIMAL(5,4)  NOT NULL DEFAULT 0.9000,
  questions_source_url TEXT          NULL,
  is_active            TINYINT(1)    NOT NULL DEFAULT 0,
  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_config_tier   CHECK (certification_tier IN ('junior','mid-level','senior')),
  UNIQUE KEY uq_config_tier (certification_tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── quiz_attempts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id                 CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id            CHAR(36)     NOT NULL,
  certification_tier VARCHAR(50)  NOT NULL,
  attempt_number     INT          NOT NULL DEFAULT 1,
  started_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at       DATETIME     NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'in_progress',
  total_correct      INT          NULL,
  total_questions    INT          NULL,
  section_errors     JSON         NULL,  -- { "A": 2, "B": 0, "C": 1 }
  score_percent      DECIMAL(5,2) NULL,
  CONSTRAINT chk_attempt_tier   CHECK (certification_tier IN ('junior','mid-level','senior')),
  CONSTRAINT chk_attempt_status CHECK (status IN ('in_progress','passed','failed')),
  CONSTRAINT fk_attempt_user    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_attempt_user_tier (user_id, certification_tier),
  INDEX idx_attempt_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── answers ───────────────────────────────────────────────────────────────────
-- final_grade = admin_override if set, else ai_grade
CREATE TABLE IF NOT EXISTS answers (
  id             CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  attempt_id     CHAR(36)    NOT NULL,
  question_id    VARCHAR(100) NOT NULL,
  section        VARCHAR(10) NOT NULL,
  user_answer    TEXT        NOT NULL,
  ai_grade       TINYINT(1)  NULL,
  ai_reasoning   TEXT        NULL,
  admin_override TINYINT(1)  NULL,
  final_grade    TINYINT(1)  GENERATED ALWAYS AS (COALESCE(admin_override, ai_grade)) STORED,
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_answer_section CHECK (section IN ('A','B','C','All')),
  CONSTRAINT fk_answer_attempt  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_attempt_question (attempt_id, question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── certifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certifications (
  id                 CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id            CHAR(36)     NOT NULL,
  certification_tier VARCHAR(50)  NOT NULL,
  attempt_id         CHAR(36)     NULL,
  granted_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by         VARCHAR(255) NOT NULL DEFAULT 'system',
  CONSTRAINT chk_cert_tier    CHECK (certification_tier IN ('junior','mid-level','senior')),
  CONSTRAINT fk_cert_user     FOREIGN KEY (user_id)    REFERENCES users(id)          ON DELETE CASCADE,
  CONSTRAINT fk_cert_attempt  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id)  ON DELETE SET NULL,
  UNIQUE KEY uq_user_cert_tier (user_id, certification_tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: default quiz configs (Junior active, others placeholder)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO quiz_configs (id, certification_tier, total_questions, section_count, passing_threshold, is_active)
VALUES
  (UUID(), 'junior',    55, 3, 0.9000, 1),
  (UUID(), 'mid-level',  0, 3, 0.9000, 0),
  (UUID(), 'senior',     0, 3, 0.9000, 0)
ON DUPLICATE KEY UPDATE certification_tier = certification_tier;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bootstrap: grant admin to kay@ldk.lat
-- Run this AFTER the first login (which creates the users row via POST /me).
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE users SET is_admin = 1 WHERE email = 'kay@ldk.lat';
