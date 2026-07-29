-- Email verification: block login on a freshly-registered account until the
-- owner proves control of the inbox by clicking a link. Closes the gap where
-- anyone could self-register any made-up @ldk.lat address and use the app
-- immediately (root cause of at least one unauthorized "ghost" account).
--
-- Existing users are grandfathered as verified (DEFAULT 1 backfills every
-- current row instantly on ADD COLUMN in MySQL 8) so this migration cannot
-- lock out anyone already using the app. New registrations explicitly insert
-- email_verified = 0 in application code, overriding the column default.
--
-- Run against RDS BEFORE deploying the Lambda/frontend that reference these.
USE ldk_quiz;

ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS email_verifications (
  id          CHAR(36)  NOT NULL PRIMARY KEY,
  user_id     CHAR(36)  NOT NULL,
  token_hash  CHAR(64)  NOT NULL,           -- sha256(raw token), hex
  expires_at  DATETIME  NOT NULL,
  used_at     DATETIME  NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_verify_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_verify_token (token_hash),
  INDEX idx_verify_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify:
--   SELECT email, email_verified FROM users ORDER BY created_at;
--   -- expect: every EXISTING row shows email_verified = 1
