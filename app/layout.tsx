import type { Metadata } from "next";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/context";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an account.",
};

export const viewport = {
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <AuthProvider>
          <Toaster position="top-center" />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
