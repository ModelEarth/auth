// Stub. Chat's lib/errors/logger.ts writes to a Supabase `error_logs` table
// via @supabase/ssr (browser) or a service-role admin client (server) — both
// are chat-specific dependencies this app doesn't have. This keeps the same
// call signature the copied components expect and just logs to the console.

export enum ErrorCategory {
  LOGIN_FAILED = "login_failed",
  REGISTRATION_FAILED = "registration_failed",
  VALIDATION_ERROR = "validation_error",
  API_RATE_LIMIT = "api_rate_limit",
  NETWORK_ERROR = "network_error",
}

export enum ErrorSeverity {
  WARNING = "warning",
  ERROR = "error",
}

export async function logAuthError(
  category: ErrorCategory,
  message: string,
  details?: Record<string, any>,
  user_id?: string,
  severity: ErrorSeverity = ErrorSeverity.ERROR
): Promise<void> {
  console.error(`[auth:${severity}:${category}]`, message, { user_id, ...details });
}
