-- Add password_hash column for custom JWT auth (replaces Supabase/Cognito)
USE ldk_quiz;

ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL AFTER full_name;
