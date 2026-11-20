"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
