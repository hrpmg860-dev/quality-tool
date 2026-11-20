import type { AccessLevel, Me, RoleInfo } from "@/types/api";

/** Mirrors backend/app/core/permissions.py. The UI only hides/disables —
 * the API enforces every check server-side. Role → permission sets are
 * table-driven (GET /roles); /auth/me returns the caller's effective set. */
export const Perm = {
  USER_MANAGE: "user.manage",
  ROLE_MANAGE: "role.manage",
  TEAM_MANAGE: "team.manage",
  DATASET_CREATE: "dataset.create",
  DATASET_READ: "dataset.read",
  UPLOAD_CREATE: "upload.create",
  UPLOAD_READ: "upload.read",
  UPLOAD_PROCESS: "upload.process",
  RECORD_READ: "record.read",
  GROUP_READ: "group.read",
  REVIEW_DECIDE: "review.decide",
  REVIEW_APPROVE: "review.approve",
  MERGE_EXECUTE: "merge.execute",
  MERGE_REVERT: "merge.revert",
  MASTER_READ: "master.read",
  EXPORT_CREATE: "export.create",
  AUDIT_READ: "audit.read",
  JOB_READ: "job.read",
} as const;

export type PermName = (typeof Perm)[keyof typeof Perm];

export const LEVELS: AccessLevel[] = ["read", "upload", "review", "manage"];

export function can(me: Me | null | undefined, perm: PermName): boolean {
  return !!me && me.permissions.includes(perm);
}

export function datasetLevel(me: Me | null | undefined, datasetId: number | null | undefined): AccessLevel | null {
  if (!me || datasetId == null) return null;
  if (me.is_admin) return "manage";
  return me.dataset_access[String(datasetId)] ?? null;
}

export function hasDatasetLevel(me: Me | null | undefined, datasetId: number | null | undefined, required: AccessLevel): boolean {
  const lvl = datasetLevel(me, datasetId);
  return lvl !== null && LEVELS.indexOf(lvl) >= LEVELS.indexOf(required);
}

/** Datasets where the user holds at least `required` (admins: all — pass the list). */
export function datasetsWithLevel<T extends { id: number }>(me: Me | null | undefined, datasets: T[], required: AccessLevel): T[] {
  return datasets.filter((d) => hasDatasetLevel(me, d.id, required));
}

/** Fallback labels for system roles; custom roles use RoleInfo.name. */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export function roleLabel(role: string | undefined, roles?: RoleInfo[]): string {
  if (!role) return "—";
  return roles?.find((r) => r.role === role)?.name ?? ROLE_LABELS[role] ?? role;
}

/** Client-side mirror of the server's no-escalation rule for the role picker:
 * a role is assignable if the caller holds all of its permissions (and is an
 * admin for admin roles). super_admin is only assignable by a super_admin. */
export function canAssignRole(me: Me | null | undefined, role: RoleInfo): boolean {
  if (!me) return false;
  if (me.role === "super_admin") return true;
  if (role.role === "super_admin" || (role.is_admin && !me.is_admin)) return false;
  return role.permissions.every((p) => me.permissions.includes(p));
}
