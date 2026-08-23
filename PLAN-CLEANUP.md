# Auth Cleanup Plan

Removal of the auth implementation from `chat`, following completion of the
`auth` submodule and its Worker. This is the final phase of `PLAN.md`.

Running any of this before the replacement is verified will break sign-in for
all users.

## Prerequisites

None of the removals below should begin until the `auth` submodule is
deployed and reachable, the Worker handles sign-in, sign-up, sign-out and
session validation, every configured OAuth provider has been tested including
in Chrome incognito, and both `chat` and `requests` can validate sessions
issued by the Worker. Existing users must be able to sign in without
re-registering.

## Immediate removals

Three files are already unused and can be deleted independently of the rest
of this plan. `app/(auth)/actions.ts` is a NextAuth-era stub with no
importers. `lib/auth/instance-edge.ts` is an unused Edge instance, also with
no importers. `app/api/auth/README.md` describes an architecture the code no
longer matches, so it is actively misleading.

## Frontend

The following can be removed once the submodule serves the sign-in pages:

- `app/auth/page.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/register/page.tsx`
- `app/(auth)/layout.tsx`
- `components/social-login-buttons.tsx`
- `components/email-password-signin.tsx`
- `components/auth-form.tsx`
- `lib/auth/client.ts`
- `lib/auth/context.tsx`
- `lib/auth/hooks.ts`
- `lib/auth/use-db-status.ts`

`components/db-status-banner.tsx` may have other consumers and should be
verified before removal.

The `/auth`, `/login` and `/register` paths should redirect to the submodule
so that existing links continue to work.

## Backend

The following can be removed once the Worker handles authentication:

- `app/api/auth/[...all]/route.ts`
- `app/api/oauth/[provider]/route.ts`
- `app/api/oauth/relay/route.ts`
- `app/api/auth/db-status/route.ts`
- `lib/auth/instance.ts`
- `lib/auth/social-providers.ts`

## Local-development panels

- `app/api/auth/local-env-values/route.ts`
- `app/api/auth/supabase-env-values/route.ts`
- `lib/auth/env-placeholder.ts`
- `components/local-env-key-panel.tsx`
- `components/supabase-key-panel.tsx`

These support the copy-keys panels on the auth page. They are localhost-only
and read from disk, which Workers do not support. Whether the feature carries
over to the submodule needs deciding before removal.

## Retained with modification

`lib/auth/server.ts` should not be removed. Its `requireAuth()`,
`requireAdmin()` and `getCurrentUser()` functions are called by around twenty
routes. What changes is their implementation, which should validate sessions
against the Worker rather than calling BetterAuth directly.

The dependent routes are the admin routes under `api/admin/`, together with
`api/vote`, `api/suggestions`, `api/history`, the file routes under
`api/files/`, `api/document`, `api/chat` and `api/models/capabilities`. Three
server components also read the session directly: `app/chat/page.tsx`,
`app/chat/[id]/page.tsx` and `app/chat/layout.tsx`.

`components/auth/rbac-guards.tsx` should also be retained, but pointed at the
new session source. It handles client-side interface gating and was never a
security boundary; enforcement is in `lib/auth/server.ts`.

## Database

The four auth tables migrate to Neon as part of phase 2 of `PLAN.md`, not as
part of cleanup. `lib/db/drizzle-schema.ts` still defines them, so a decision
is needed on whether the schema definition moves to the Worker or remains
shared.

## Environment variables

Auth variables can be removed from `chat` once the Worker owns them.
`POSTGRES_URL` should be retained, since `chat` uses it for chat history and
documents as well as auth.

## Verification

After cleanup, confirm that sign-in works with email and password and with
each configured OAuth provider, that sign-out works, and that the session
persists across a page reload. Confirm that an admin user can reach the admin
pages and a non-admin user cannot, that chat history loads for a signed-in
user, and that `requests` still recognises the session.