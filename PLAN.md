# PLAN.md — auth submodule

The goal is to move authentication out of the chat repo and into this
standalone auth submodule, so that chat, requests, and any future Rust or
.NET frontends can all share the same sign-in.

Before writing this plan I went through the current auth code in chat to see
what is actually there. What follows is based on that.

## One thing to flag first

The keys submodule is a clean case for a static frontend. It reads and writes
values in the browser, and the worker only has to say which keys are set.

Auth is not like that. Roughly half of what chat calls auth is server work
that cannot run in a browser at all. That includes the OAuth token exchange
with Google, GitHub, LinkedIn, Microsoft, Discord and Facebook, creating and
validating sessions, and writing to four database tables. There are also
about twenty routes in chat that check whether a user is signed in before
they will run.

The sign-in page itself moves easily. The server side has to be rebuilt on
the worker rather than just moved across. I wanted to say that up front,
because it changes how long this takes.

## What is in chat today

The sign-in page is `app/auth/page.tsx`. It pulls in the social login
buttons, the email and password form, and the shared form wrapper. There are
separate login and register pages under `app/(auth)/`, with the register page
being the largest single file at around 500 lines. On the client side,
`lib/auth/client.ts` talks to BetterAuth, and `context.tsx` and `hooks.ts`
hold the session state for React. All of this can move into this submodule.

The server side is smaller in file count but harder to move.
`app/api/auth/[...all]/route.ts` handles every BetterAuth endpoint, so
sign-in, sign-up, sign-out, session checks and OAuth callbacks all go through
it. There are two more routes under `app/api/oauth/` that exist to work
around Chrome incognito blocking cookies, which I will come back to.
`lib/auth/instance.ts` holds the BetterAuth configuration, and
`lib/auth/server.ts` has the functions that other routes call to check
permissions.

While reading through this I found some code that is no longer used.
`app/(auth)/actions.ts` is left over from an earlier NextAuth setup and
nothing imports it. `lib/auth/instance-edge.ts` was written for edge
middleware but is also unused. The README in `app/api/auth/` describes an
architecture that no longer matches the code. All three can be deleted
whenever, they are not really part of this migration.

There is also a set of files behind the copy-keys panels on the auth page.
They read the .env.example file off disk, which does not work on Cloudflare
Workers, and they only run on localhost anyway. We should decide whether that
feature carries over before doing anything with them.

## Questions I need answered before starting

**Which database approach should the worker use?**

BetterAuth needs a database. Right now that is Postgres through a driver that
does not run on Cloudflare Workers, because it opens a raw TCP connection.
There are three ways round it. We could keep BetterAuth and reach Supabase
through a Cloudflare Hyperdrive binding, which keeps the most existing code.
We could keep BetterAuth but talk to Supabase over HTTP instead. Or we could
drop BetterAuth and use Supabase Auth directly, which is the biggest change
but removes the most complexity.

**Should the frontend and the worker share a domain?**

The two OAuth routes I mentioned exist because Chrome in incognito mode
blocks cookies that are set through a cross-origin request. If the static
frontend and the worker end up on different domains, that problem gets worse
rather than better. Putting the worker behind a path on the same domain would
avoid it.

**How do the remaining chat routes check sessions?**

About twenty routes in chat call `requireAuth()` or `requireAdmin()` before
running. Once auth moves out, they still need a way to know who is signed in.
Either they ask the auth worker, or they verify the session token themselves
using a shared secret.

## Rough order of work

I would start by moving just the sign-in pages into this submodule while they
still call the existing chat endpoints. That proves the frontend works on its
own without touching anything that could break sign-in.

After that, building the auth worker, pointing the frontend at it, and then
giving chat and requests a way to check sessions against it. Cleanup comes
last, and only once everything else is confirmed working. That part is in
PLAN-CLEANUP.md.

Happy to reorder any of this.

## Environment variables

These are in docker/.env today and would move to the CloudRoot worker folder.

BETTER_AUTH_SECRET, which has to be at least 32 characters.
BETTER_AUTH_BASE_URL. ALLOWED_ORIGINS, which is required in production.
POSTGRES_URL, or a Hyperdrive binding instead. REQUIRE_AUTH, which is
optional. Then a client ID and secret for each social provider we have turned
on.

One small thing worth fixing at some point. docker/.env has FACEBOOK_APP_ID
and FACEBOOK_APP_SECRET, but the code reads FACEBOOK_CLIENT_ID and
FACEBOOK_CLIENT_SECRET. The APP ones look like they are not used by anything.

## Database

There are four tables, all managed by BetterAuth. The user table, which has a
role field we added. The session table. The account table, which holds the
provider tokens and the password hash. And a verification table for email
verification, which we are not currently using.

If the worker connects to the same Supabase database, nothing needs to be
migrated and people stay signed in.