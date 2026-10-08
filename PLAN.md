# Auth Plan

Move authentication out of the `chat` repo into this standalone `auth`
submodule, so that `chat`, `requests`, and future Rust and .NET frontends can
share one sign-in. The frontend is a static export in this repo. The backend
is BetterAuth running in the CloudRoot Worker.

Status as of October 2026, for whoever continues the work. This file merges
Deeba's handover note with the earlier `PLAN.md` and `PLAN-CLEANUP.md`, and
was checked against the code on 7 October 2026. Companion documents:
`PLAN.md` at the CloudRoot root (the single-Worker deployment) and
`worker/README.md` (API, config and secrets).

File paths below were checked; line numbers may move. Items marked
*unverified* were not tested.

## Where things stand

```
cloud.model.earth ──┬─ /auth/      this repo's static export (auth/out)
  (CloudRoot Worker)├─ /api/auth/* BetterAuth, CloudRoot worker/src/auth/
                    └─ /api/oauth/* social sign-in for pages on other origins
chat (Vercel)       ── its own BetterAuth, unchanged, still the live sign-in for chat
```

The Worker runs without a database for now (no `POSTGRES_URL`): sessions
live in an encrypted cookie, social sign-in works, and email/password is off.

Delivered:

| Repo | Change | Content |
|---|---|---|
| auth | PR #1 | The first `PLAN.md` and `PLAN-CLEANUP.md` (merged into this file) |
| auth | PR #2 | Standalone Next.js app with `/login` and `/register` |
| auth | PR #3 | `db/0001_create_better_auth_tables.sql`, the four BetterAuth tables |
| auth | PR #4 | `/auth` page without the chat app shell |
| auth | ca48e1d | Static export served at `/auth/`, same-origin API, vanilla widget in `public/js/`, `db/0002_enable_pgcrypto.sql` |
| chat | PR #38 | Neon HTTP driver for the database client |
| chat | PR #39 | `/api/auth/configured-providers` endpoint |
| CloudRoot | PR #4, #7, #8 | pnpm fix in the chat deploy workflow, fork deploy steps, README update |
| CloudRoot | 7bca03b | One Worker at cloud.model.earth: static site, `/api/*`, sign-in |

## Database

### Worker: any Postgres, chosen by `POSTGRES_URL`

Workers can't keep a pooled Postgres client, so `worker/src/auth/db.js` picks
a driver from the URL:

- **Neon** (`*.neon.tech`): `@neondatabase/serverless` over HTTP, through
  Drizzle's `neon-http` adapter. No connection to open, so it's the fastest
  option on Workers. Preferred. *Unverified*: no Neon database existed when
  the Worker was built.
- **Any other Postgres (Supabase, Azure, ...)**: postgres.js over a TCP
  socket, one connection per request, through Drizzle's `postgres-js`
  adapter. Supabase should use its pooler URL (port 6543), since the direct
  host is IPv6-only on newer projects. Cloudflare Hyperdrive could add
  pooling later.

BetterAuth's Drizzle adapter accepts either client. The Worker's schema
(`worker/src/auth/schema.js`) matches `db/0001_create_better_auth_tables.sql`.

### chat: Neon only

`chat/lib/db/queries/base.ts` now uses `drizzle-orm/neon-http` (PR #38). The
swap was verified against a Neon database with an insert, a read-back and a
delete over HTTP.

- `@neondatabase/serverless` is listed explicitly (`^1.1.0`). `drizzle-orm`
  needs 0.10.0 or newer as a peer, and the 0.9.5 copy that arrived
  transitively was below that.
- The driver connects only to Neon, so chat's database queries no longer
  work against Supabase. The local env file's `POSTGRES_URL` still points at
  Supabase, so chat needs a Neon URL before its database features work again.
- Nine modules share the client from `base.ts` (chat history, documents,
  admin, usage, GitHub queries and auth). They moved to HTTP mode together and
  should be tested together.
- HTTP mode has no transactions: `db.transaction()` throws. Nothing in chat
  or the Worker calls it, and BetterAuth's Drizzle adapter uses transactions
  only under MySQL or when `transaction` is set in its config. Leave it unset
  in both chat and the Worker.

### Migration history

No migration file in chat creates the four BetterAuth tables (`user`,
`session`, `account`, `verification`). The `migrate.ts` runner executes a
hardcoded list of twelve SQL files, none of which creates them.
`meta/0011_snapshot.json` has entries for them but the journal has no
matching migration, so they were probably applied with `drizzle-kit push`.

- `db/0001_create_better_auth_tables.sql` in this repo recreates them from
  chat's `lib/db/drizzle-schema.ts`, and ran successfully on an empty Neon
  database.
- `db/0002_enable_pgcrypto.sql` enables pgcrypto, which the Worker's password
  hashing needs. Run it after 0001 on any new database. The hashing was tested
  locally on PGlite, not yet on Neon.
- The live production schema was never compared with this SQL. A
  `pg_dump --schema-only` of the four tables would show any drift.
- `chat/DEPLOYMENT_GUIDE.md` Step 2 holds a second copy of the same DDL. Two
  copies can drift, so point the guide at `db/0001` instead.

### User id type mismatch

BetterAuth's `user.id` column is `text`, but chat's own tables declare
`user_id` as `uuid` (`chat/lib/db/drizzle-schema.ts`, seven tables). Chat
saves fail after sign-up when the id isn't a UUID.

The cause: `chat/lib/auth/instance.ts` sets `advanced.generateId:
() => crypto.randomUUID()`, but in BetterAuth 1.6 the database adapter reads
only `advanced.database.generateId` (`@better-auth/core`,
`db/adapter/get-id-field.mjs`). chat's setting is ignored for rows the
adapter creates, so users get BetterAuth's default 32-character ids. The
Worker already uses `advanced.database.generateId` and creates UUIDs.

Fixed in chat: `generateId` is now under `advanced.database`, and new
sign-ups get UUIDs (tested on PGlite). Users already
created with non-UUID ids keep failing until either those ids are rewritten
(in `user` and the `user_id` columns of `session` and `account`) or chat's
`user_id` columns change to `text`. Whether production has such users is
*unverified*.

## Password storage

Hashes are one-way; recovery is by reset only.

**Hashing runs in Postgres.** The free Workers plan allows 10 ms of CPU per
request, and BetterAuth's default scrypt takes longer. Time spent waiting on
the database doesn't count, so the Worker hashes and checks passwords with
pgcrypto's bcrypt (`crypt(password, gen_salt('bf', 10))`): it sends the
password, waits, and continues in the same request
(`worker/src/auth/password.js`). bcrypt reads only the first 72 bytes.

**Existing scrypt hashes** from chat are checked once in the Worker with
`node:crypto` and rewritten as bcrypt. That one check may exceed the
free-plan CPU limit; if it does, the user resets their password.

**chat hashes the same way.** `chat/lib/auth/password.ts` uses the same
pgcrypto SQL as the Worker, with the same scrypt fallback and upgrade
(chat's `lib/db/migrations/0014_pgcrypto.sql` enables the extension).
Tested on PGlite: each side verifies the other's hashes, and a legacy
scrypt account signs in through chat and is rewritten as bcrypt.

**Share a database once that's deployed.** chat deployments that predate
this change can verify only scrypt, so anyone who signs up through the
Worker couldn't sign in to them. Until chat's change is live, the env file
keeps the Worker's database as `AUTH_POSTGRES_URL`, apart from chat's
`POSTGRES_URL`, and `automation/sync-config.sh` syncs `POSTGRES_URL` only
with `--database`. After that, both can hold the same Neon URL.

## Supabase dependencies that remain in chat

Moving `POSTGRES_URL` to Neon doesn't remove Supabase from chat.
`lib/db/supabase-client.ts` builds clients from `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, which reach
Supabase through its REST API, not the Postgres connection string.

| Feature | Files | Notes |
|---|---|---|
| File storage | `app/(chat)/api/files/upload`, `delete`, `retrieve`; `lib/ai/file-context-builder.ts` | Supabase Storage. `@vercel/blob` is already a dependency and could replace it. |
| Activity and error logging | `lib/logging/activity-logger.ts`, `lib/errors/logger.ts` | Writes `user_activity_logs`, `agent_activity_logs` and `error_logs` through PostgREST. |
| Log purge | `lib/db/queries/admin.ts` | Calls `purge_old_activity_logs` over RPC. |
| Legacy session viewer | `components/admin/jwt-token-viewer.tsx` | Calls Supabase's own auth API. Probably dead since the BetterAuth migration. |

A decision is needed: move storage elsewhere and rewrite logging to use
Drizzle against Neon, or keep a Supabase project for these two features.
Until then a chat deployment needs both Neon and Supabase.

## Sessions and origins

**Origin model.** *Resolved.* The Worker serves the pages and the API on one
origin, so sign-in on cloud.model.earth is first-party. Pages on other
origins (e.g. model.earth) use the widget's `/api/oauth/:provider` navigation
plus `/api/oauth/relay`, which works in Chrome incognito. Worker cookies are
`SameSite=Lax`; model.earth subdomains count as the same site.

**Session validation in chat.** About twenty files in chat call
`requireAuth()`, `requireAdmin()` or `getCurrentUser()` from
`lib/auth/server.ts`. Once chat uses the Worker's sign-in, those helpers need
to either call the Worker or verify its session tokens locally against the
shared `BETTER_AUTH_SECRET`. `requests` needs the same.

## Phases

1. ✅ **Static frontend.** This repo, built as a static export
   (`basePath: /auth`). It calls the API on its own origin, or
   `NEXT_PUBLIC_AUTH_API_URL`.
2. **Neon migration.** chat's driver is switched (✅ PR #38). Remaining:
   provision Neon, run `db/0001` and `db/0002`, set the Worker's
   `POSTGRES_URL`; fix chat's `generateId` (✅); give chat's BetterAuth the
   same pgcrypto hash and verify functions (✅); copy the four auth tables from
   Supabase. All users are signed out once at cutover; password hashes move
   with `account`, so credentials stay valid.
3. ✅ **Auth Worker.** `CloudRoot/worker/src/auth/`, deployed alongside
   chat's implementation rather than replacing it.
4. **Cutover.** Point other sites' widgets at cloud.model.earth. Verify each
   OAuth provider, including in Chrome incognito.
5. **Session validation.** Give chat and `requests` a way to validate
   sessions issued by the Worker.
6. **Cleanup.** Remove the old implementation from chat (below).

Ordering is open to revision.

## Cleanup in chat (phase 6)

Running this before the replacement is verified breaks sign-in for every
chat user.

**Prerequisites.** The Worker handles sign-in, sign-up, sign-out and session
validation against a real database. Every configured OAuth provider is
tested, including in Chrome incognito. chat and `requests` validate sessions
issued by the Worker. Existing users sign in without re-registering.

**Removable now.** Three files are dead: `app/(auth)/actions.ts` (a
NextAuth-era stub), `lib/auth/instance-edge.ts` (an unused Edge instance) and
`app/api/auth/README.md`, which describes an architecture the code no longer
matches and is the only file that mentions the other two.

**Frontend**, once chat links to `/auth/` here:
`app/auth/page.tsx`, `app/(auth)/login/page.tsx`,
`app/(auth)/register/page.tsx`, `app/(auth)/layout.tsx`,
`components/social-login-buttons.tsx`, `components/email-password-signin.tsx`,
`components/auth-form.tsx`, `lib/auth/client.ts`, `lib/auth/context.tsx`,
`lib/auth/hooks.ts`, `lib/auth/use-db-status.ts`,
`components/db-status-banner.tsx` (used only by the register page and
`email-password-signin.tsx`), and the vanilla widget copy in `chat/auth/`.
Redirect `/auth`, `/login` and `/register` so existing links keep working.

**Backend**, once the Worker handles chat's sign-in:
`app/api/auth/[...all]/route.ts`, `app/api/oauth/[provider]/route.ts`,
`app/api/oauth/relay/route.ts`, `app/api/auth/db-status/route.ts`,
`app/api/auth/configured-providers/route.ts`, `lib/auth/instance.ts`,
`lib/auth/social-providers.ts`.

**Local-development panels:** `app/api/auth/local-env-values/route.ts`,
`app/api/auth/supabase-env-values/route.ts`, `lib/auth/env-placeholder.ts`,
`components/local-env-key-panel.tsx`, `components/supabase-key-panel.tsx`.
They support the copy-keys panels on chat's auth page, run only on localhost
and read `.env.example` from disk. They weren't carried into this repo;
decide whether the feature is still wanted before removing them.

**Keep, with changes:**
- `lib/auth/server.ts`: keep `requireAuth()`, `requireAdmin()` and
  `getCurrentUser()`, but validate sessions against the Worker. Callers
  include the admin routes under `api/admin/`, `api/vote`,
  `api/suggestions`, `api/history`, the routes under `api/files/`,
  `api/document`, `api/chat`, `api/models/capabilities`, and the server
  components `app/chat/page.tsx`, `app/chat/[id]/page.tsx` and
  `app/chat/layout.tsx`. `isEmailPasswordUser()` there queries the auth
  tables directly.
- `components/auth/rbac-guards.tsx`: point it at the new session source. It
  gates the interface only; enforcement is in `lib/auth/server.ts`.
- `lib/db/drizzle-schema.ts`: decide whether the auth table definitions stay
  shared or move to the Worker.
- `POSTGRES_URL` stays in chat for chat history and documents. Other auth
  variables can go once the Worker owns them.

**Verify afterwards:** email/password and each OAuth provider sign in;
sign-out works; the session survives a reload; an admin reaches the admin
pages and a non-admin can't; chat history loads; `requests` recognises the
session.

## Environment variables

Set on the Worker as secrets, uploaded from GitHub secrets by
`deploy-worker.yml`. Copy them from the local env file with
`automation/sync-config.sh` (see `automation/paths.yaml`).

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Minimum 32 characters |
| `BETTER_AUTH_BASE_URL` | Optional; defaults to the request's origin |
| `ALLOWED_ORIGINS` | Other origins allowed to call the API (`wrangler.toml` `[vars]`) |
| `POSTGRES_URL` | Neon, or any Postgres; unset means stateless sessions |
| `<PROVIDER>_CLIENT_ID` and `_SECRET` | One pair per provider: Google, GitHub, Microsoft, LinkedIn, Discord, Facebook. GitHub's pair is stored in GitHub secrets as `GH_CLIENT_ID` / `GH_CLIENT_SECRET`, since GitHub reserves the `GITHUB_` prefix |

Register each OAuth app's callback as
`https://cloud.model.earth/api/auth/callback/<provider>`. `REQUIRE_AUTH`
stays with chat; it gates chat's own pages.

## Schema

Four tables, managed by BetterAuth's Drizzle adapter. `user` has a custom
`role` field defaulting to `user`. `session` holds expiry, token, IP address
and user agent. `account` holds provider tokens and the password hash.
`verification` holds email verification tokens and is currently unused.

## Chat on Cloudflare: blocked

chat stays on Vercel. Running it on Cloudflare through OpenNext is blocked:

- Next.js 16 renamed `middleware.ts` to `proxy.ts` and runs it on the
  Node.js runtime only; a `runtime` option in a proxy file throws.
- OpenNext's Cloudflare adapter rejects Node.js middleware. The upstream fix
  (opennextjs-cloudflare PR #1320) was closed unmerged on 2 August 2026;
  related issues are #617 and #1277.
- Other Node-only code on the request path would need porting:
  `app/faq/page.tsx`, `app/keys/[asset]/route.ts`,
  `lib/auth/env-placeholder.ts`, `lib/repos.ts` and `lib/google/sheets-*.ts`
  use the filesystem, and `lib/server-crypto.ts` uses `node:crypto` RSA
  operations (*unverified* on Workers).

The parts of chat that cloud.model.earth needs (sign-in and the small key
APIs) run in the CloudRoot Worker instead. See CloudRoot `PLAN.md`,
"Superseded".

## Cloudflare limits

- **Static files:** 20,000 per Worker version on the free plan, 100,000 on
  paid (Wrangler 4.34 or newer; the Worker uses 4.147). The site is far under
  this today, but the count grows with the webroot.
- **CPU:** 10 ms per request on the free plan, not counting time waiting on
  the database. See "Password storage".

## Repository traps

- `git submodule update` checks out the commit CloudRoot records, not the
  latest. A submodule at an older commit shows as modified in `git status`,
  and committing that silently reverts other people's pointer updates. Check
  `git status` before committing in CloudRoot.
- A submodule pinned to a commit that no longer exists on its remote fails
  the whole checkout. This happened with `sanity` in `webroot`.
- GitHub shows no workflows on a fork whose `main` is behind the upstream
  branch that added them. See `automation/README.md`.
- `automation/sync-config.sh` needs bash. On Windows without WSL, the
  PowerShell fallback in `automation/README.md` covers only the two
  Cloudflare values.
- Stale forks of chat exist on contributors' machines. Check `git remote -v`
  and the position against `origin/main` before analysing a checkout.

## Open items, in suggested order

1. Add `NEON_API_KEY` to the env file and run
   `node automation/setup-neon.mjs` in CloudRoot. It creates the Neon
   project, runs `db/0001` then `db/0002`, saves `AUTH_POSTGRES_URL`, sets
   the Worker's `POSTGRES_URL` secret and redeploys. Then test
   email/password sign-in on cloud.model.earth.
2. Register the OAuth apps with the callback above, then test each provider
   on cloud.model.earth and from model.earth, including in Chrome incognito.
3. Deal with existing non-UUID user ids in chat's database (chat's
   `generateId` is fixed, so new users get UUIDs).
4. Decide what happens to Supabase storage and logging in chat.
5. Compare the live auth schema with `db/0001`.
6. Update `chat/DEPLOYMENT_GUIDE.md`: Neon for `POSTGRES_URL`, point at
   `db/0001` instead of its own DDL, and port 3700 (it still lists 8888;
   `server.mjs` defaults to 3700).
7. Deploy chat's pgcrypto hashing, run its `0014_pgcrypto.sql` migration,
   then point chat's `POSTGRES_URL` at the Worker's Neon database.
8. Session validation for chat and `requests` (phase 5), then the cleanup
   above (phase 6).
