// Origin of the sign-in API (/api/auth, /api/oauth). Empty by default, which
// means this page's own origin — on Cloudflare the same Worker serves both
// these pages (/auth/) and the API (/api/). Set NEXT_PUBLIC_AUTH_API_URL only
// when the API lives elsewhere, e.g. http://localhost:3700 (chat's server)
// while running `pnpm dev` on port 3000.
export function authApiUrl(): string {
  if (process.env.NEXT_PUBLIC_AUTH_API_URL) return process.env.NEXT_PUBLIC_AUTH_API_URL;
  return typeof window !== "undefined" ? window.location.origin : "http://localhost";
}
