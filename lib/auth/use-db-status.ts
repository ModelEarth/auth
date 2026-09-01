"use client";

import { useEffect, useState } from "react";

// Distinguishes "nothing set up yet" from "configured but currently down" —
// the two need different messages (and different fix-it links) wherever a
// sign-in/sign-up form needs to explain why it's disabled.
//
// This type lived in chat's lib/auth/db-status.ts alongside the server-only
// getDbStatus() function. That function isn't ported here (it talks to
// Postgres directly), so this is now the only definition of DbStatus in
// this app — db-status-banner.tsx and email-password-signin.tsx both import
// it from here instead.
export type DbStatus = "ok" | "not-configured" | "unreachable";

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:3700";

// This app has no server of its own to compute DbStatus, so it fetches it
// from chat's existing /api/auth/db-status route instead of the relative
// same-origin path the original hook used. Defaults to "ok" while loading
// so the form doesn't flash a false-positive warning before the first
// response arrives.
export function useDbStatus(): DbStatus {
  const [status, setStatus] = useState<DbStatus>("ok");

  useEffect(() => {
    fetch(`${AUTH_API_URL}/api/auth/db-status`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.status) setStatus(data.status);
      })
      .catch(() => {});
  }, []);

  return status;
}
