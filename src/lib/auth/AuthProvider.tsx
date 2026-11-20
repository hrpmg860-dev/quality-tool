"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from "react";
import { sessionRequest, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { can, type PermName } from "@/lib/permissions";
import type { Me } from "@/types/api";

interface AuthState {
  me: Me | undefined;
  isLoading: boolean;
  error: unknown;
  can: (perm: PermName) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: endpoints.me, staleTime: 60_000 });

  const toLogin = useCallback(() => {
    qc.clear();
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [qc, pathname, router]);

  const logout = useCallback(async () => {
    await sessionRequest("/api/auth/logout").catch(() => undefined);
    qc.clear();
    router.replace("/login");
  }, [qc, router]);

  useEffect(() => {
    // Session expired / revoked / account deactivated: the proxy already
    // cleared the cookies; send the user to sign in again.
    const handler = () => toLogin();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [toLogin]);

  const value = useMemo<AuthState>(() => ({
    me: meQuery.data,
    isLoading: meQuery.isLoading,
    error: meQuery.error,
    can: (perm) => can(meQuery.data, perm),
    logout,
  }), [meQuery.data, meQuery.isLoading, meQuery.error, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
