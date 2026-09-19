"use client";

import { useEffect, useState } from "react";

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? "http://localhost:3700";

// This app has no server of its own to compute which social providers are
// configured — that requires reading provider client-id/secret env vars,
// which live on chat's server, not here. Fetches chat's existing
// /api/auth/configured-providers route instead. Defaults to an empty list
// while loading so buttons render disabled rather than flashing every
// provider as enabled before the first response arrives.
export function useConfiguredProviders(): readonly string[] {
  const [providers, setProviders] = useState<readonly string[]>([]);

  useEffect(() => {
    fetch(`${AUTH_API_URL}/api/auth/configured-providers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.providers)) setProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  return providers;
}
