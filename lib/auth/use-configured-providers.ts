"use client";

import { useEffect, useState } from "react";
import { authApiUrl } from "@/lib/auth/api-url";


// This app has no server of its own to compute which social providers are
// configured — that requires reading provider client-id/secret env vars,
// which live on the sign-in API's server. Fetches its
// /api/auth/configured-providers route instead. Returns null while loading,
// so the page can tell "still loading" from "none configured".
export function useConfiguredProviders(): readonly string[] | null {
  const [providers, setProviders] = useState<readonly string[] | null>(null);

  useEffect(() => {
    fetch(`${authApiUrl()}/api/auth/configured-providers`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProviders(Array.isArray(data?.providers) ? data.providers : []);
      })
      .catch(() => setProviders([]));
  }, []);

  return providers;
}
