[Google](#google) | [GitHub](#github) | [Discord](#discord) | [LinkedIn](#linkedin) | [Microsoft](#microsoft) | [Facebook](#facebook) | [Settings](#settings)

---

# OAuth Provider Setup

Social sign-in for the auth widget is run by BetterAuth in the CloudRoot
Worker (`worker/src/auth/` in CloudRoot), which serves the sign-in API at
`/api` on **https://cloud.model.earth**. This repo holds only the pages and
the widget. See [PLAN.md](PLAN.md) for status and [README.md](README.md) for
how the pieces fit.

Each provider uses a server-side redirect flow. The browser goes to
`/api/oauth/:provider`, which redirects to the provider's authorization page,
and the provider then calls back to `/api/auth/callback/:provider`.

A provider turns on when both its `CLIENT_ID` and `CLIENT_SECRET` are set. One
without the other is ignored. The widget asks
`/api/auth/configured-providers` which ones are on, and hides the rest
(greys them out on localhost).

Originated from chat's `auth/oauth-setup.md`, which covers chat's own
sign-in server (port 3700 and modelearth.vercel.app).

## Callback URL

Register this redirect URI in each provider's developer console, replacing
`<provider>` with the provider name given below:

```
https://cloud.model.earth/api/auth/callback/<provider>
```

For local development, also register the callback of the server that answers
`/api` on your localhost webroot, e.g.
`http://localhost:<port>/api/auth/callback/<provider>`. localsite points
localhost pages at `/api` on their own origin, so they never call
cloud.model.earth. That local API reads the local env file named by
`automation/paths.yaml`.

---

<span id="google"></span>

## Google

Provider name: `google`

### 1. Create or open a project

Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials). Select an existing project or click **New Project**.

### 2. Configure the OAuth consent screen

Go to **APIs & Services → OAuth consent screen**.
- Choose **External** (unless restricting to your org).
- Fill in app name, support email, and developer contact email.
- Under **Scopes**, add: `userinfo.email`, `userinfo.profile`, `openid`.

### 3. Create OAuth credentials

Click **+ Create Credentials → OAuth client ID**.
- **Application type:** Web application

### 4. Add authorized redirect URIs

Under **Authorized redirect URIs**:
```
https://cloud.model.earth/api/auth/callback/google
```

> **Note:** The Google Identity Services (GSI) sign-in button uses *Authorized JavaScript origins* instead of redirect URIs, and is a different flow. BetterAuth uses redirect URIs only.

### 5. Copy credentials

Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and **Client secret**.

---

<span id="github"></span>

## GitHub

Provider name: `github`

1. Go to [GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Authorization callback URL**:
   ```
   https://cloud.model.earth/api/auth/callback/github
   ```
4. Copy the **Client ID** and click **Generate a new client secret**

GitHub reserves the `GITHUB_` prefix for its own secrets, so this pair is
stored in GitHub secrets as `GH_CLIENT_ID` and `GH_CLIENT_SECRET`.

---

<span id="discord"></span>

## Discord

Provider name: `discord`

1. Go to [Discord Developer Portal → Applications](https://discord.com/developers/applications)
2. Open your app (or create one) → **OAuth2** → **Redirects**
3. Add:
   ```
   https://cloud.model.earth/api/auth/callback/discord
   ```
4. Copy the **Client ID** and **Client Secret** from the OAuth2 page

---

<span id="linkedin"></span>

## LinkedIn

Provider name: `linkedin`

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Open your app → **Auth** tab
3. Under **Authorized redirect URLs**, add:
   ```
   https://cloud.model.earth/api/auth/callback/linkedin
   ```
4. Copy the **Client ID** and **Client Secret**

---

<span id="microsoft"></span>

## Microsoft

Provider name: `microsoft`

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Open your app (or click **New registration**) → **Authentication → Redirect URIs**
3. Add:
   ```
   https://cloud.model.earth/api/auth/callback/microsoft
   ```
4. Copy the **Application (client) ID**
5. Go to **Certificates & secrets → New client secret** and copy the value

---

<span id="facebook"></span>

## Facebook

Provider name: `facebook`

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Open your app → **Facebook Login → Settings**
3. Under **Valid OAuth Redirect URIs**, add:
   ```
   https://cloud.model.earth/api/auth/callback/facebook
   ```
4. Copy the **App ID** and **App Secret** from the app dashboard

---

<span id="settings"></span>

## Settings

Put the values in your local env file (see `automation/paths.yaml`). For the
Worker, `automation/sync-config.sh` copies them to GitHub secrets, and the
deploy workflow uploads them as Worker secrets.

```
BETTER_AUTH_SECRET=           # required, at least 32 characters: openssl rand -base64 32
POSTGRES_URL=                 # optional; unset means stateless, OAuth-only sessions

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=             # stored in GitHub secrets as GH_CLIENT_ID / GH_CLIENT_SECRET
GITHUB_CLIENT_SECRET=

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

| Setting | Where | Notes |
|---|---|---|
| `BETTER_AUTH_BASE_URL` | Worker secret | Optional; defaults to the request's origin |
| `ALLOWED_ORIGINS` | CloudRoot `wrangler.toml` `[vars]` | Other sites whose pages call the API, e.g. `https://model.earth` |
