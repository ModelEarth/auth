-- =====================================================
-- Migration: Create BetterAuth core tables
-- Source: chat/lib/db/drizzle-schema.ts lines 197-242
--   (betterAuthUser, betterAuthSession, betterAuthAccount, betterAuthVerification)
-- Purpose: hand-written equivalent of what `drizzle-kit push` applied
--   directly to chat's database — no .sql migration file in chat's repo
--   creates these tables, so there's nothing to copy from there.
-- Target: a fresh, empty Neon Postgres database. Run once, in order,
--   before pointing BetterAuth's drizzleAdapter at this database.
-- =====================================================

BEGIN;

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "role" text DEFAULT 'user',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

COMMIT;

-- =====================================================
-- ROLLBACK (commented out, for reference)
-- =====================================================
-- BEGIN;
-- DROP TABLE IF EXISTS "account";
-- DROP TABLE IF EXISTS "session";
-- DROP TABLE IF EXISTS "verification";
-- DROP TABLE IF EXISTS "user";
-- COMMIT;
