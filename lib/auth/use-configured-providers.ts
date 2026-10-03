"use client";

import { useEffect, useState } from "react";
import { authApiUrl } from "@/lib/auth/api-url";


// This app has no server of its own to compute which social providers are
// configured — that requires reading provider client-id/secret env vars,
// which live on the sign-in API's server. Fetches its
// /api/auth/configured-providers route instead. Defaults to an empty list
// while loading so buttons render disabled rather than flashing every
// provider as enabled before the first response arrives.
export function useConfiguredProviders(): readonly string[] {
  const [providers, setProviders] = useState<readonly string[]>([]);

  useEffect(() => {
    fetch(`${authApiUrl()}/api/auth/configured-providers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.providers)) setProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  return providers;
}
