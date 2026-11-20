import {
  BarChart3, Database, FileDown, GitMerge, History, KeyRound, LayoutDashboard, type LucideIcon, ScrollText, Search,
  Settings, ShieldCheck, Upload, Users, UsersRound,
} from "lucide-react";
import { Perm, type PermName } from "@/lib/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: PermName;
}

export const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    section: "Data",
    items: [
      { href: "/uploads/new", label: "Upload dataset", icon: Upload, perm: Perm.UPLOAD_CREATE },
      { href: "/uploads", label: "Upload history", icon: History, perm: Perm.UPLOAD_READ },
      { href: "/datasets", label: "Datasets", icon: Database, perm: Perm.DATASET_READ },
    ],
  },
  {
    section: "Deduplication",
    items: [
      { href: "/analysis", label: "Duplicate analysis", icon: BarChart3, perm: Perm.GROUP_READ },
      { href: "/review", label: "Review center", icon: ShieldCheck, perm: Perm.GROUP_READ },
      { href: "/masters", label: "Master records", icon: GitMerge, perm: Perm.MASTER_READ },
      { href: "/search", label: "Record search", icon: Search, perm: Perm.RECORD_READ },
    ],
  },
  {
    section: "Governance",
    items: [
      { href: "/exports", label: "Reports & exports", icon: FileDown, perm: Perm.EXPORT_CREATE },
      { href: "/audit", label: "Audit trail", icon: ScrollText, perm: Perm.AUDIT_READ },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/admin/users", label: "User management", icon: Users, perm: Perm.USER_MANAGE },
      { href: "/admin/teams", label: "Teams", icon: UsersRound },
      { href: "/admin/roles", label: "Roles & permissions", icon: KeyRound, perm: Perm.USER_MANAGE },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Most specific nav item that owns `pathname` (so /uploads/new ≠ /uploads). */
export function activeHref(pathname: string): string | undefined {
  const all = NAV.flatMap((s) => s.items.map((i) => i.href));
  return all.filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)
    .find((h) => !(h === "/uploads" && pathname === "/uploads/new"));
}
