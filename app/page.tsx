"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SocialLoginButtons } from "@/components/social-login-buttons";
import { EmailPasswordSignIn } from "@/components/email-password-signin";
import { useDbStatus } from "@/lib/auth/use-db-status";
import { useConfiguredProviders } from "@/lib/auth/use-configured-providers";

// Matches /login and /register — chat's version of this page reads
// process.env.VERCEL, which is server-only and unavailable to a client
// component. NEXT_PUBLIC_VERCEL_URL is the client-safe equivalent.
const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL;
// Sites using this page work without an account unless NEXT_PUBLIC_REQUIRE_AUTH
// is "true" at build time (like chat's REQUIRE_AUTH).
const accountOptional = process.env.NEXT_PUBLIC_REQUIRE_AUTH !== "true";

function getErrorMessage(error: string, provider?: string): string | null {
  if (error === "account_not_linked") {
    return "An account with this email already exists. Please sign in with your email and password instead.";
  }
  if (error === "provider_not_configured") {
    const name = provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)}` : "This provider";
    return `${name} login is not configured. Add ${provider?.toUpperCase()}_CLIENT_ID and ${provider?.toUpperCase()}_CLIENT_SECRET where the sign-in API runs (Worker secrets, or your local env file).`;
  }
  if (error) {
    return "Sign-in failed. Please try again.";
  }
  return null;
}

function AuthPageContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? undefined;
  const provider = searchParams.get("provider") ?? undefined;
  const errorMessage = error ? getErrorMessage(error, provider) : null;
  const dbStatus = useDbStatus();
  const configuredProviders = useConfiguredProviders();
  const hasSocial = !!configuredProviders && configuredProviders.length > 0;

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background p-[18px]">
      <div className="flex flex-1 items-start justify-center pt-12 md:items-center md:pt-0 min-h-[60vh]">
        <div className="flex w-full max-w-2xl flex-col gap-6 px-4">
          <div className="flex flex-col items-center justify-center gap-2 pt-4 text-center">
            <h3 className="font-semibold text-xl dark:text-zinc-50">
              {accountOptional ? "Account Optional" : "Account"}
            </h3>
            <p className="text-gray-600 text-sm dark:text-zinc-300">
              Creating an account is optional. You can{" "}
              <a className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-zinc-50" href="/keys/">
                paste LLM keys
              </a>{" "}
              in your browser.
            </p>
            {hasSocial && (
              <p className="text-gray-500 text-sm dark:text-zinc-400">
                Sign in with any social account to save chat history and access team features.
              </p>
            )}
          </div>
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </div>
          )}
          <SocialLoginButtons configuredProviders={configuredProviders} />
          <EmailPasswordSignIn dbStatus={dbStatus} isVercel={isVercel} showDivider={hasSocial} />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-screen items-center justify-center bg-background">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
