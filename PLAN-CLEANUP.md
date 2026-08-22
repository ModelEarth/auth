\# PLAN-CLEANUP.md — removing auth from chat



This is the last step of PLAN.md. None of it should happen until the auth

submodule and its worker are deployed and confirmed working, because doing it

early would break sign-in for everyone.



\## Before starting



Everything below assumes the auth submodule is live, the worker handles

sign-in, sign-up, sign-out and session checks, every social login has been

tested including in Chrome incognito, and both chat and requests can

recognise a session created by the worker. Existing users should be able to

sign in without registering again.



\## Can be deleted straight away



Three things are already unused and can go at any point, whether or not the

rest of this has happened.



`app/(auth)/actions.ts` is left over from the old NextAuth setup and nothing

imports it. `lib/auth/instance-edge.ts` was written for edge middleware and

is also unused. The README in `app/api/auth/` describes an architecture the

code no longer matches, so it is misleading rather than helpful.



\## Frontend files



Once the submodule is serving the sign-in pages, these can come out of chat:



`app/auth/page.tsx`, `app/(auth)/login/page.tsx`,

`app/(auth)/register/page.tsx`, `app/(auth)/layout.tsx`,

`components/social-login-buttons.tsx`,

`components/email-password-signin.tsx`, `components/auth-form.tsx`,

`lib/auth/client.ts`, `lib/auth/context.tsx`, `lib/auth/hooks.ts`, and

`lib/auth/use-db-status.ts`.



`components/db-status-banner.tsx` may be used elsewhere, so that one needs

checking first.



The /auth, /login and /register paths should redirect to the new submodule so

that existing links carry on working.



\## Backend files



Once the worker is handling authentication, these can come out:



`app/api/auth/\[...all]/route.ts`, `app/api/oauth/\[provider]/route.ts`,

`app/api/oauth/relay/route.ts`, `app/api/auth/db-status/route.ts`,

`lib/auth/instance.ts`, and `lib/auth/social-providers.ts`.



\## The copy-keys panels



`app/api/auth/local-env-values/route.ts`,

`app/api/auth/supabase-env-values/route.ts`, `lib/auth/env-placeholder.ts`,

`components/local-env-key-panel.tsx` and `components/supabase-key-panel.tsx`

are all part of the copy-keys panels on the auth page.



These only run on localhost and they read files off disk, which will not work

on Cloudflare. We should decide whether the new auth submodule keeps this

feature in some form before removing them.



\## What stays but needs changing



`lib/auth/server.ts` should not be deleted. Around twenty routes call

`requireAuth()`, `requireAdmin()` or `getCurrentUser()` from it. What needs to

change is how those functions check a session, so that they ask the worker

instead of calling BetterAuth directly.



The routes affected are the admin ones under `api/admin/`, along with

`api/vote`, `api/suggestions`, `api/history`, the file routes under

`api/files/`, `api/document`, `api/chat` and `api/models/capabilities`. There

are also three server components that read the session directly, which are

the chat page, the individual chat page, and the chat layout.



`components/auth/rbac-guards.tsx` also stays. It handles showing and hiding

things in the browser based on whether someone is signed in. It was never a

security check, the real checks are in `lib/auth/server.ts`, but it still

needs pointing at the new session source.



\## Database



The four auth tables should be left alone. As long as the worker uses the

same Supabase database there is nothing to migrate and people stay signed in.



`lib/db/drizzle-schema.ts` still defines those tables, so we need to decide

whether that definition moves to the worker or stays shared.



\## Environment variables



The auth variables can come out of chat once the worker owns them.

POSTGRES\_URL should stay, because chat uses it for chat history and documents

as well as auth.



\## Checking afterwards



Worth going through sign-in with email and password, sign-in with each social

provider, signing out, and reloading the page to confirm the session sticks.

Then check that an admin can reach the admin pages and a normal user cannot,

that chat history still loads, and that requests still recognises the

session.

