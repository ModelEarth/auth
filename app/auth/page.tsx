"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SocialLoginButtons } from "@/components/social-login-buttons";
import { EmailPasswordSignIn } from "@/components/email-password-signin";
import { useDbStatus } from "@/lib/auth/use-db-status";

// Matches /login and /register — chat's version of this page reads
// process.env.VERCEL, which is server-only and unavailable to a client
// component. NEXT_PUBLIC_VERCEL_URL is the client-safe equivalent.
const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL;

function getErrorMessage(error: string, provider?: string): string | null {
  if (error === "account_not_linked") {
    return "An account with this email already exists. Please sign in with your email and password instead.";
  }
  if (error === "provider_not_configured") {
    const name = provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)}` : "This provider";
    return `${name} login is not configured. Add ${provider?.toUpperCase()}_CLIENT_ID and ${provider?.toUpperCase()}_CLIENT_SECRET to your .env.local file and restart the server.`;
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

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background p-[18px]">
      <div className="flex flex-1 items-start justify-center pt-12 md:items-center md:pt-0 min-h-[60vh]">
        <div className="flex w-full max-w-2xl flex-col gap-6 px-4">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <h3 className="font-semibold text-xl dark:text-zinc-50">Account</h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              Sign in with any social account to save chat history and access team features.
            </p>
          </div>
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {errorMessage}
            </div>
          )}
          <SocialLoginButtons />
          <EmailPasswordSignIn dbStatus={dbStatus} isVercel={isVercel} showDivider />
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
