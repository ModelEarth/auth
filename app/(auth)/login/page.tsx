"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { EmailPasswordSignIn } from "@/components/email-password-signin";
import { useAuth } from "@/lib/auth/hooks";
import { useDbStatus } from "@/lib/auth/use-db-status";

const isVercel = !!process.env.NEXT_PUBLIC_VERCEL_URL;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, user } = useAuth();
  const dbStatus = useDbStatus();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      const returnTo = searchParams.get("returnTo") || "/chat";
      router.push(returnTo);
    }
  }, [user, loading, router, searchParams]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
          <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Keep showing spinner while redirect to /chat is in flight
  if (user) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full flex-col bg-background p-[18px]">
      <div className="flex flex-1 items-start justify-center pt-12 md:items-center md:pt-0">
        <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl">
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
            <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
            <p className="text-gray-500 text-sm dark:text-zinc-400">
              Use your email and password to sign in
            </p>
          </div>
          <EmailPasswordSignIn dbStatus={dbStatus} isVercel={isVercel} />
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
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-gray-900 border-b-2 dark:border-gray-100" />
            <p className="mt-2 text-gray-600 text-sm dark:text-gray-400">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
