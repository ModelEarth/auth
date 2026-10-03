"use client";

import { InfoIcon } from "@/components/icons";
import type { DbStatus } from "@/lib/auth/use-db-status";

const SETUP_GUIDE_URL = "https://github.com/ModelEarth/auth#database";

export function getDbStatusMessage(status: DbStatus, isVercel: boolean): string {
  if (status === "not-configured") {
    return isVercel
      ? "Activate by adding POSTGRES_URL to your Vercel environment variables."
      : "Activate by adding POSTGRES_URL where the sign-in API runs: a Cloudflare Worker secret, or your local env file (see automation/paths.yaml).";
  }
  if (status === "unreachable") {
    return "Can't reach the database. Free-tier Neon and Supabase databases pause when idle, so check that yours is active.";
  }
  return "";
}

// Shared by EmailPasswordSignIn (/auth, /login) and /register so all three
// pages explain a down/unset database the same way, with the same fix-it
// link.
export function DbStatusBanner({
  status,
  isVercel,
  className = "",
}: {
  status: DbStatus;
  isVercel: boolean;
  className?: string;
}) {
  if (status === "ok") return null;

  const message = getDbStatusMessage(status, isVercel);
  const linkHref = SETUP_GUIDE_URL;
  const linkLabel = "Database setup";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 ${className}`}
    >
      <span>{message}</span>
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={linkLabel}
        title={linkLabel}
        className="shrink-0 opacity-70 hover:opacity-100"
      >
        <InfoIcon size={14} />
      </a>
    </div>
  );
}
