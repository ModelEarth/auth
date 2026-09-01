export type User = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  role: "admin" | "user";
  createdAt: Date;
  updatedAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type UserMetadata = {
  role?: "admin" | "user";
  isActive?: boolean;
  settings?: {
    theme?: string;
    defaultModel?: string;
    notifications?: boolean;
  };
};

export type SignUpEmailStatus =
  | "sent"
  | "already_registered"
  | "rate_limited"
  | "smtp_failed"
  | "unknown";
