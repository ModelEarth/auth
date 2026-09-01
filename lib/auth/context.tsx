"use client";

import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import {
  signIn as clientSignIn,
  signOut as clientSignOut,
  signUp as clientSignUp,
  type SignUpEmailStatus,
  type UserMetadata,
} from "./client";
import type { User, Session } from "./types";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: "admin" | "user" | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: Partial<UserMetadata>) => Promise<SignUpEmailStatus>;
  signOut: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: sessionData, isPending, refetch: refetchSession } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  // better-auth's own refetch-on-focus only listens to `visibilitychange`
  // (see node_modules/better-auth's focus-manager.mjs) and rate-limits to
  // once per 5s — it can miss a page restored from the browser's
  // back-forward cache (bfcache), which freezes the whole JS context
  // (including any session fetch already in flight) and resumes it exactly
  // as it was. `pageshow` with `event.persisted === true` is the dedicated
  // signal for "this page came back from bfcache" and isn't covered by
  // that rate limit, so force a fresh refetch here to unstick isPending.
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) refetchSession();
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [refetchSession]);

  const user = sessionData?.user ? (sessionData.user as unknown as User) : null;
  const session = sessionData?.session ? (sessionData.session as unknown as Session) : null;
  const role: "admin" | "user" | null = user ? (user.role === "admin" ? "admin" : "user") : null;

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: err } = await clientSignIn(email, password);
    if (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata?: Partial<UserMetadata>
  ): Promise<SignUpEmailStatus> => {
    setError(null);
    const result = await clientSignUp(email, password, metadata);
    if (result.error) {
      setError(result.error.message);
      throw result.error;
    }
    return result.emailStatus;
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    const { error: err } = await clientSignOut();
    if (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthContextType = {
    user,
    session,
    role,
    loading: isPending,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isAuthenticated: !!user,
    isAdmin: role === "admin",
    isUser: role === "user",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within an AuthProvider");
  return context;
}

export function useRequireAuth(redirectTo?: string) {
  const { user, session, role, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !session || !role)) {
      const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
      const returnTo = redirectTo || currentPath;
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [user, session, role, loading, redirectTo, router]);

  if (loading || !user || !session || !role) {
    return { user: null, session: null, role: null, loading: true };
  }
  return { user, session, role, loading: false };
}

export function useRequireAdmin(redirectTo = "/") {
  const { user, session, role, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !session || role !== "admin")) {
      router.push(redirectTo);
    }
  }, [user, session, role, loading, redirectTo, router]);

  if (loading || !user || !session || role !== "admin") {
    return { user: null, session: null, role: null, loading: true };
  }
  return { user, session, role: "admin" as const, loading: false };
}
