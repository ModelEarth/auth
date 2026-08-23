# Auth Submodule Plan

Move authentication out of the `chat` repo into a standalone `auth`
submodule: a static frontend backed by a Cloudflare Worker, so that `chat`,
`requests`, and future Rust and .NET frontends can share a single sign-in.

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

**Decision: Neon, using the Neon serverless driver.**

Cloudflare Workers cannot open raw TCP connections, which rules out the
current `drizzle-orm/postgres-js` client. The Neon serverless driver
(`@neondatabase/serverless`) carries queries over HTTP instead, and works
identically on Workers and on Vercel. Drizzle's `neon-http` adapter is
already available in the installed version (0.45.2), so no ORM upgrade is
required.

The change in `lib/db/queries/base.ts` is around ten lines. Two imports
change, and the connection-pool configuration is removed, since HTTP mode is
stateless and has no pool. `lib/auth/instance.ts` requires no changes,
because BetterAuth's Drizzle adapter accepts any Drizzle client.

**This ties the Worker to Neon.** The driver targets Neon's own HTTP endpoint
and does not work against Supabase. Migrating auth to a Worker and migrating
the database to Neon are therefore a single decision rather than two.

### Supporting other hosts

Supporting Supabase or Azure alongside Neon requires a second connection
path, either the driver's WebSocket mode or Cloudflare Hyperdrive. Both
behave differently from HTTP mode and need independent testing. This is
recommended as a later phase rather than an initial requirement.

### Constraints

Transactions are unavailable in HTTP mode. The driver throws on any call to
`db.transaction()`. Nothing in `chat` currently calls it, and BetterAuth's
adapter only uses transactions under MySQL or with a configuration flag that
is not set here. This is a constraint on future code rather than a present
blocker.

The swap affects more than auth. Nine modules share the client exported from
`base.ts`, covering chat history, documents, admin configuration, usage
tracking and GitHub queries as well as auth. All of them move to HTTP mode
simultaneously and should be tested together.

Migration is required. Moving from Supabase to Neon means migrating the four
auth tables, and all users are signed out once at cutover. Password hashes
migrate with the `account` table, so existing credentials remain valid.

## Password storage

BetterAuth hashes passwords one-way by default. Stored values cannot be
reversed, and recovery is by reset only. No additional work is required to
meet this requirement.

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

**Origin model.** The two OAuth proxy routes exist because Chrome incognito
blocks `SameSite=None` cookies set through a cross-origin fetch. Splitting
the frontend and the Worker across different origins makes this harder rather
than easier. Serving the Worker under a path on the same domain would avoid
the problem.

**Session validation in `chat`.** Around twenty routes call `requireAuth()`
or `requireAdmin()`. Once auth moves out, they need either to call the auth
Worker or to verify session tokens locally against a shared secret.

## Phases

1. **Static frontend.** Move the sign-in interface into this submodule, still
   calling the existing `chat` endpoints. This proves the frontend stands
   alone without risking sign-in.
2. **Neon migration.** Provision Neon, migrate the four auth tables, and
   switch `base.ts` to `drizzle-orm/neon-http`.
3. **Auth Worker.** Build the backend in `CloudRoot/worker`, deployed
   alongside the existing implementation rather than replacing it.
4. **Cutover.** Point the submodule at the Worker. Verify each OAuth
   provider, including in Chrome incognito.
5. **Session validation.** Give `chat` and `requests` a way to validate
   sessions issued by the Worker.
6. **Cleanup.** Remove the old implementation from `chat`, as set out in
   `PLAN-CLEANUP.md`.

Ordering is open to revision.

## Environment variables

The following move from `docker/.env` to `CloudRoot/worker`.

| Variable | Notes |
|---|---|
| `BETTER_AUTH_SECRET` | Minimum 32 characters |
| `BETTER_AUTH_BASE_URL` | Falls back to `VERCEL_URL`, then localhost |
| `ALLOWED_ORIGINS` | Required in production |
| `POSTGRES_URL` | Becomes the Neon connection string |
| `REQUIRE_AUTH` | Optional |
| `<PROVIDER>_CLIENT_ID` and `_SECRET` | One pair per social provider |

`@neondatabase/serverless` also needs adding to `chat/package.json`
explicitly, since it is currently only present transitively through Drizzle.

`docker/.env` defines `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`, but the
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