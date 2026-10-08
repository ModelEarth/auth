# Auth Handover

Status of the auth work as of October 2026, for whoever continues it. Companion documents: `PLAN.md` and `PLAN-CLEANUP.md` in this repository, and `PLAN.md` at the CloudRoot root, which covers the single-Worker deployment.

Findings below come from investigating the `chat` repo during September 2026. File paths and line references may have moved since, so verify before acting. Items marked *unverified* were not tested.

## Status

Delivered and merged:

|Repo|PR|Content|
|-|-|-|
|auth|#1|`PLAN.md` and `PLAN-CLEANUP.md`|
|auth|#2|Standalone Next.js app with `/login` and `/register`|
|auth|#3|SQL that creates the four BetterAuth tables|
|auth|#4|`/auth` page without the chat app shell|
|chat|#38|Neon HTTP driver for the database client|
|chat|#39|`/api/auth/configured-providers` endpoint|
|CloudRoot|#4, #7, #8|pnpm fix in the chat deploy workflow, fork deploy steps, README update|

Not done:

* The Neon path of Worker sign-in has not been tested, because no Neon database was available when the Worker was built.
* The Neon update to `chat/DEPLOYMENT\_GUIDE.md`.
* A decision on what happens to Supabase storage and logging (see below).
* The user id type mismatch (see below).
* Cleanup of auth code in `chat`, as described in `PLAN-CLEANUP.md`.

## Database

### Neon driver

The `chat` database client was switched from `drizzle-orm/postgres-js` to `drizzle-orm/neon-http` in `lib/db/queries/base.ts`. The swap was verified against a Neon database with an insert, a read-back and a delete over HTTP before the PR was opened.

* `@neondatabase/serverless` is pinned to 1.1.0 and listed explicitly. `drizzle-orm` requires 0.10.0 or newer as a peer, and the 0.9.5 copy that arrived transitively was below that.
* The driver connects only to Neon. After PR #38, `chat` database queries no longer work against Supabase.
* HTTP mode does not support transactions. `db.transaction()` throws. Nothing in `chat` calls it, and BetterAuth's Drizzle adapter uses transactions only under MySQL or when `transaction` is set in its config. Keep that option unset.
* Nine modules share the client exported from `base.ts`: chat history, documents, admin, usage, GitHub queries and auth. All moved to HTTP mode together.

### Missing migration history

The four BetterAuth tables (`user`, `session`, `account`, `verification`) are not created by any migration file in `chat`. The `migrate.ts` runner executes a hardcoded list of twelve SQL files and none of them creates these tables. `meta/0011\_snapshot.json` contains entries for them but the journal has no matching migration, which is consistent with the tables having been applied directly with `drizzle-kit push`.

`db/0001\_create\_better\_auth\_tables.sql` in this repository recreates them from `lib/db/drizzle-schema.ts` and was run successfully against an empty Neon database.

* The live production schema was never compared with this SQL, because no live connection string was available. Comparing against a `pg\_dump --schema-only` of the four tables would catch any drift.
* `chat/DEPLOYMENT\_GUIDE.md` Step 2 contains a separate copy of the same DDL. Two copies can diverge, so consolidating them is worth considering.
* `db/0002\_enable\_pgcrypto.sql` was added after the first SQL file. It appears to enable the extension that the Worker's in-database password hashing relies on (\*unverified\*), so a new database needs it as well.

### User id type mismatch

BetterAuth generates text ids, and the `user.id` column is `text`, but `Chat.user\_id` is typed `uuid`. Chat saves fail after sign-up as a result. This was reported and is unresolved. The two possible directions are changing `Chat.user\_id` to `text`, or configuring BetterAuth to generate UUIDs. BetterAuth's id generation setting should be checked for the second option (*unverified*).

## Supabase dependencies that remain

Moving `POSTGRES\_URL` to Neon does not remove Supabase from `chat`. `lib/db/supabase-client.ts` creates clients from `NEXT\_PUBLIC\_SUPABASE\_URL`, `NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY` and `SUPABASE\_SERVICE\_ROLE\_KEY`, and these reach Supabase through its REST API, not through the Postgres connection string.

|Feature|Files|Notes|
|-|-|-|
|File storage|`app/(chat)/api/files/upload`, `delete`, `retrieve`; `lib/ai/file-context-builder.ts`|Uses Supabase Storage. `@vercel/blob` is already a dependency and is a possible replacement.|
|Activity and error logging|`lib/logging/activity-logger.ts`, `lib/errors/logger.ts`|Writes to `user\_activity\_logs`, `agent\_activity\_logs` and `error\_logs` through PostgREST.|
|Log purge|`lib/db/queries/admin.ts`|Calls the `purge\_old\_activity\_logs` function over RPC.|
|Legacy session viewer|`components/admin/jwt-token-viewer.tsx`|Calls Supabase's own auth API. Probably dead code since the BetterAuth migration.|

A decision is needed: move storage elsewhere and rewrite the logging calls to use Drizzle against Neon, or keep a Supabase project for these two features. Until then, a deployment needs both a Neon database and a Supabase project.

## Chat on Cloudflare

Running `chat` on Cloudflare through OpenNext is blocked, and `chat` stays on Vercel.

* Next.js 16 renamed `middleware.ts` to `proxy.ts` and runs it on the Node.js runtime only. Setting a `runtime` option in a Proxy file throws an error.
* OpenNext's Cloudflare adapter rejects Node.js middleware outright. An upstream fix (opennextjs-cloudflare PR #1320) was verified by its author and closed unmerged on 2 August 2026 after a maintainer disagreement. Related issues are #617 and #1277. The latest release at the time was 1.20.2.
* Other Node-only code on the request path would also need porting: `app/faq/page.tsx`, `app/keys/\[asset]/route.ts`, `lib/auth/env-placeholder.ts`, `lib/repos.ts` and `lib/google/sheets-\*.ts` use the filesystem. `lib/server-crypto.ts` uses `node:crypto` RSA operations, whose Workers support is *unverified*.

## Cloudflare limits

* Static assets: the free plan allows 20,000 files per Worker version. The paid plan allows 100,000 but needs Wrangler 4.34 or newer. The worker deploy was using Wrangler 3.114 in August. The site fits today, and the limit matters as the webroot grows.
* CPU time: the free plan allows 10 ms per request, and time spent waiting on Neon does not count. Password hashing in the Worker would count. The CloudRoot `PLAN.md` handles new passwords by hashing inside Postgres, and older `chat` passwords are verified once in the Worker, with a password reset as the fallback if that exceeds the limit.

## Repository traps

* `git submodule update` checks out the commit the superproject records, not the latest. A submodule sitting at an older commit shows as modified in `git status`, and committing that silently reverts other people's pointer updates. Check `git status` before committing in CloudRoot.
* A submodule pinned to a commit that no longer exists on its remote fails the whole checkout. This occurred with `sanity` in `webroot`.
* GitHub shows no workflows on a fork whose `main` is behind the upstream branch that added them. See `automation/README.md`.
* `automation/sync-config.sh` needs bash. On Windows without WSL, the PowerShell fallback in `automation/README.md` covers only the two Cloudflare values.
* Stale forks of `chat` exist on contributors' machines. Confirm which remote a checkout points at (`git remote -v`) and its position against `origin/main` before analysing it.



## Open items, in suggested order

1. Create a Neon project for the team, run `db/0001\_create\_better\_auth\_tables.sql` and then `db/0002\_enable\_pgcrypto.sql`, set `POSTGRES\_URL`, sync it as described in the CloudRoot `PLAN.md`, and test the Neon path of Worker sign-in.
2. Check sign-in from an incognito window on `cloud.model.earth`. Same-origin cookies may make the two OAuth proxy routes in `chat` unnecessary (*unverified*).
3. Resolve the user id type mismatch.
4. Decide what happens to Supabase storage and logging.
5. Compare the live auth schema with the SQL in this repository.
6. Update `chat/DEPLOYMENT\_GUIDE.md` for Neon. It still describes Supabase for `POSTGRES\_URL` and lists port 8888, where `server.mjs` defaults to 3700.
7. Run the cleanup in `PLAN-CLEANUP.md` only after Worker sign-in is verified for every configured provider.

