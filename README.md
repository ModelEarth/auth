# auth

Sign-in pages shared across ModelEarth frontends, built as plain static
files. Served at **https://cloud.model.earth/auth/** by the CloudRoot
Worker, which also runs the sign-in API (`/api/auth`) on the same origin.

| Path | Page |
|---|---|
| `/auth/` | Social sign-in buttons, plus email and password (`app/page.tsx`) |
| `/auth/login/` | Email and password only |
| `/auth/register/` | Create an account |
| `/auth/js/auth-plugin.js` | Drop-in widget for other pages: injects sign-in into `#accountPanelInserts`, or a floating button (`public/js/`) |
| `/auth/js/auth-modal.js` | Popup the widget loads when needed |

localsite loads the widget from the path in the site's `webroot.yaml`
`auth:` block (CloudRoot's points at `/auth/js/auth-plugin.js`).

## How it runs

This is a Next.js app with `output: "export"` and `basePath: "/auth"`
(`next.config.mjs`). Every page is a client component calling the sign-in
API from the browser, so `pnpm build` writes plain HTML/JS/CSS to `out/`
and no Next.js server is involved. CloudRoot's deploy workflow builds it and
copies `out/` into the Worker's static files.

The API (BetterAuth) isn't in this repo. It lives in CloudRoot's
`worker/src/auth/` and is documented in `worker/README.md`.

| Setting | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_AUTH_API_URL` | this page's origin | Set only when the API is elsewhere, e.g. for `pnpm dev` (see `.env.example`) |

The widget finds the API the same way: `window.AUTH_API_URL` when localsite
sets it, otherwise `/api` on the origin the script was loaded from.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000/auth/ — set NEXT_PUBLIC_AUTH_API_URL first
pnpm build        # static export to out/
pnpm type-check
```

## Database

Sign-in works without a database: sessions are kept in an encrypted cookie,
so social sign-in works but email/password doesn't. To store users, give the
Worker a Postgres database as `POSTGRES_URL`. Neon is preferred; Supabase and
other Postgres hosts work too.

In CloudRoot, `node automation/setup-neon.mjs` does all of this, given a
`NEON_API_KEY` in the env file (see `automation/README.md`). By hand:

1. Create the database.
2. Run `db/0001_create_better_auth_tables.sql`, then
   `db/0002_enable_pgcrypto.sql`. Passwords are hashed by Postgres (pgcrypto
   bcrypt), which keeps the Worker under Cloudflare's CPU limit.
3. Set `POSTGRES_URL` for the Worker. See `worker/README.md` in CloudRoot,
   "Database", which also explains why it shouldn't share chat's current
   database.

When `/auth/` shows "Can't reach the database", a free-tier Neon or Supabase
database has probably paused; open its dashboard to wake it.

See [PLAN.md](PLAN.md) for status, open items, and the cleanup of the old
copy in `chat`.
