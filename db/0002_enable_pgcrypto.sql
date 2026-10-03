-- =====================================================
-- Migration: Enable pgcrypto for password hashing
-- Purpose: the CloudRoot Worker hashes and checks passwords inside Postgres
--   with pgcrypto's crypt()/gen_salt('bf') (bcrypt), so the Worker itself
--   stays under Cloudflare's CPU limit — see worker/src/auth/password.js.
-- Target: Neon or Supabase (on Supabase pgcrypto is usually enabled
--   already, in the "extensions" schema). Run once, after 0001.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Check: should return t
-- SELECT crypt('test', gen_salt('bf', 10)) LIKE '$2a$10$%';
