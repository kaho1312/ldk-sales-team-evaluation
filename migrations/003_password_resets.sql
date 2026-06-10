-- Password reset tokens for self-service "forgot password" and admin-sent reset
-- invites. Only a SHA-256 hash of the token is stored; the raw token lives only in
-- the emailed link. Tokens are single-use (used_at) and time-limited (expires_at).
-- Run against RDS MySQL 8 once, before deploying the reset routes.
USE ldk_quiz;

CREATE TABLE IF NOT EXISTS password_resets (
  id          CHAR(36)  NOT NULL PRIMARY KEY,
  user_id     CHAR(36)  NOT NULL,
  token_hash  CHAR(64)  NOT NULL,           -- sha256(raw token), hex
  expires_at  DATETIME  NOT NULL,
  used_at     DATETIME  NULL,
  created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_token (token_hash),
  INDEX idx_reset_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
