# Auth Submodule Plan

Move authentication out of the `chat` repo into a standalone `auth`
submodule: a static frontend backed by a Cloudflare Worker, so that `chat`,
`requests`, and future Rust and .NET frontends can share a single sign-in.

**Status (Oct 2026):** phases 1 and 3 are built. The frontend is a static
export served at `cloud.model.earth/auth/`, and the backend runs in
`CloudRoot/worker/src/auth/` on the same origin. The Worker runs without a
database (stateless sessions) until Neon is provisioned. See CloudRoot's
`PLAN.md` and `worker/README.md`.

## Scope

Auth is not a pure frontend extraction. The sign-in interface moves across
unchanged, but roughly half of the current auth surface is server work that
cannot run in a browser. That includes the OAuth token exchange with six
providers, session creation and validation, writes to four database tables,
and the authorization checks that gate around twenty routes in `chat`.

The server side therefore has to be rebuilt on the Worker rather than
relocated. This plan treats the frontend move and the backend rebuild as
separate efforts.

## Database

**Decision: Neon preferred, any Postgres supported, chosen by `POSTGRES_URL`.**

Cloudflare Workers can't keep a regular pooled Postgres client, so the
Worker (`worker/src/auth/db.js`) picks a driver from the URL:

- **Neon** (`*.neon.tech`): `@neondatabase/serverless` over HTTP, through
  Drizzle's `neon-http` adapter. Stateless, with no connection to open, so
  it's the fastest option on Workers.
- **Any other Postgres (Supabase, Azure, ...)**: `postgres` (postgres.js) over
  a TCP socket, one connection per request, through Drizzle's `postgres-js`
  adapter. Supabase should use its pooler URL (port 6543), since the direct
  host is IPv6-only on newer projects. Cloudflare Hyperdrive would add
  pooling here if that's needed later.

BetterAuth's Drizzle adapter accepts either client, and the schema
(`worker/src/auth/schema.js`) matches `db/0001_create_better_auth_tables.sql`.

### Constraints

Transactions are unavailable in Neon's HTTP mode. BetterAuth's adapter runs
with `transaction: false` (its default), and nothing here calls
`db.transaction()`. That constrains future code, not current code.

For `chat`, the switch to Neon still affects more than auth. Nine modules
share the client exported from `lib/db/queries/base.ts`, covering chat
history, documents, admin configuration, usage tracking and GitHub queries
as well as auth, and they should be tested together.

Migration is required. Moving from Supabase to Neon means migrating the four
auth tables, and all users are signed out once at cutover. Password hashes
migrate with the `account` table, so existing credentials remain valid (see
below).

## Password storage

Hashes are one-way; recovery is by reset only.

**Hashing runs in Postgres.** The free Workers plan allows 10 ms of CPU per
request, and BetterAuth's default scrypt takes longer than that. The limit
counts only time the Worker spends computing, not time waiting on the
database. So the Worker hashes and checks passwords with pgcrypto's bcrypt
(`crypt(password, gen_salt('bf', 10))`): it sends the password, waits for the
result, and continues in the same request. `db/0002_enable_pgcrypto.sql`
enables the extension; it's available on Neon and Supabase alike.

**Existing scrypt hashes** (created by chat's Node BetterAuth) are checked
once in the Worker with `node:crypto` and rewritten as bcrypt. That one check
may exceed the free-plan CPU limit; if it does, the user resets their
password.

**Consequence for a shared database:** chat's Node BetterAuth can't verify
bcrypt. So the Worker must not share chat's database until chat uses the
same hash and verify functions. That change belongs with phase 2, after
which one database serves both.

## Current implementation in `chat`

### Frontend, which moves to this submodule

`app/auth/page.tsx` is the sign-in page. It composes
`components/social-login-buttons.tsx`, `components/email-password-signin.tsx`
and `components/auth-form.tsx`. Separate login and register routes live under
`app/(auth)/`, the register page being the largest file at roughly 500 lines.
Client-side session state is held in `lib/auth/client.ts`,
`lib/auth/context.tsx` and `lib/auth/hooks.ts`.

### Backend, which is rebuilt on the Worker

`app/api/auth/[...all]/route.ts` handles every BetterAuth endpoint, covering
sign-in, sign-up, sign-out, session checks and OAuth callbacks. Two further
routes under `app/api/oauth/` exist to work around Chrome incognito blocking
cross-origin cookies. Configuration lives in `lib/auth/instance.ts`, and
`lib/auth/server.ts` provides the authorization helpers used across `chat`.

### Unused code

Three files are dead and can be removed independently of this work.
`app/(auth)/actions.ts` is a NextAuth-era stub with no importers.
`lib/auth/instance-edge.ts` is an unused Edge instance, also with no
importers. `app/api/auth/README.md` describes an architecture the code no
longer matches.

### Local-development panels

`app/api/auth/local-env-values/route.ts`,
`app/api/auth/supabase-env-values/route.ts` and `lib/auth/env-placeholder.ts`
support the copy-keys panels on the auth page. They read `.env.example` from
disk, which Workers do not support, and they only run on localhost. Whether
this feature carries over needs deciding before they are touched.

## Open questions

**Origin model.** *Resolved.* The Worker serves the pages and the API on one
origin (`cloud.model.earth`), so sign-in on the site is first-party. Pages on
other origins (e.g. model.earth) use the widget's `/api/oauth/:provider`
navigation plus the relay, which keeps working in Chrome incognito. Cookies
are `SameSite=Lax`; model.earth subdomains are the same site.

**Session validation in `chat`.** Around twenty routes call `requireAuth()`
or `requireAdmin()`. Once auth moves out, they need either to call the auth
Worker or to verify session tokens locally against a shared secret.

## Phases

1. ✅ **Static frontend.** The sign-in interface is in this submodule, built
   as a static export (`basePath: /auth`). It calls the API on its own
   origin by default, or `NEXT_PUBLIC_AUTH_API_URL`.
2. **Neon migration.** Provision Neon, run `db/0001` and `db/0002`, and set the
   Worker's `POSTGRES_URL`. For chat: switch `base.ts` to
   `drizzle-orm/neon-http`, give its BetterAuth the same pgcrypto hash and
   verify functions, then copy the four auth tables from Supabase.
3. ✅ **Auth Worker.** Built in `CloudRoot/worker/src/auth`, deployed
   alongside chat's implementation rather than replacing it.
4. **Cutover.** Point other sites' widgets at `cloud.model.earth`. Verify each
   OAuth provider, including in Chrome incognito.
5. **Session validation.** Give `chat` and `requests` a way to validate
   sessions issued by the Worker.
6. **Cleanup.** Remove the old implementation from `chat`, as set out in
   `PLAN-CLEANUP.md`.

Ordering is open to revision.

## Environment variables

Set on the Worker as secrets, pushed from GitHub secrets by
`deploy-worker.yml` (copy them from the local env file with
`automation/sync-config.sh`; see `automation/paths.yaml`).

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Minimum 32 characters |
| `BETTER_AUTH_BASE_URL` | Optional; defaults to the request's origin |
| `ALLOWED_ORIGINS` | Other origins allowed to call the API (`wrangler.toml` `[vars]`) |
| `POSTGRES_URL` | Neon, or any Postgres; unset means stateless sessions |
| `<PROVIDER>_CLIENT_ID` and `_SECRET` | One pair per social provider. GitHub's pair is stored in GitHub secrets as `GH_CLIENT_ID` / `GH_CLIENT_SECRET`, since GitHub reserves the `GITHUB_` prefix |

`REQUIRE_AUTH` stays with `chat`; it gates chat's own pages.

The local env file defines `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`, but the
code reads `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET`. The `APP_`
names appear to be unused.

## Schema

Four tables are managed by BetterAuth's Drizzle adapter. The `user` table
includes a custom `role` field defaulting to `user`. The `session` table
holds expiry, token, IP address and user agent. The `account` table holds
provider tokens and the password hash. The `verification` table holds email
verification tokens and is currently unused.

One place queries these directly: `isEmailPasswordUser()` in
`lib/auth/server.ts`, which checks whether a user has only a credential
provider linked.