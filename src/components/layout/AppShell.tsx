"use client";

import { Layers, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ErrorState, ForbiddenState, LoadingBlock } from "@/components/ui/states";
import { useAuth } from "@/lib/auth/AuthProvider";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { activeHref, NAV } from "./nav";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const active = activeHref(pathname);
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-5">
        <div className="rounded-md bg-brand-500 p-1.5"><Layers className="h-4 w-4 text-white" /></div>
        <span className="text-[15px] font-semibold tracking-tight text-white">Opscore</span>
        <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Dedup</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((section) => {
          const items = section.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={section.section}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.section}</p>
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} onClick={onNavigate} aria-current={active === i.href ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                        active === i.href ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100",
                      )}>
                      <i.icon className="h-4 w-4 shrink-0" />
                      {i.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  if (!me) return null;
  const initials = me.display_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight text-slate-900" data-testid="current-user">{me.display_name}</p>
        <p className="text-xs leading-tight text-slate-500">{me.email}</p>
      </div>
      <Badge tone={me.is_admin ? "indigo" : "gray"}>{me.role_name ?? roleLabel(me.role)}</Badge>
      <div aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials}</div>
      <button onClick={logout} aria-label="Sign out" title="Sign out"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { me, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-slate-900 lg:block"><Sidebar /></aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">
            <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute right-2 top-4 rounded p-1 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto"><UserMenu /></div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          {isLoading ? <LoadingBlock label="Loading your workspace…" /> : error || !me ? <ErrorState error={error} /> : children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && (
        <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          {breadcrumb.map((b, i) => (
            <span key={b.href} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              <Link href={b.href} className="hover:text-slate-800">{b.label}</Link>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Page-level permission gate (UX only — the API enforces too). */
export function RequirePerm({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  if (allowed) return <>{children}</>;
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <ForbiddenState />
    </div>
  );
}
