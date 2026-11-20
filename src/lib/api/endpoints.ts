import type {
  AccessEntry, AccessLevel, AuditLog, ChainVerification, ColumnMapping, Dataset, DatasetTeam, DecisionIn,
  DecisionResult, ExportItem, ExportType, Group, GroupDetail, GroupHistory, GroupStats, Health, Job, MasterDetail,
  MasterListItem, Match, MatchDetail, Me, MyTeam, Overview, Page, PermissionInfo, Preview, RecordDetail, RecordItem,
  RevertResult, Role, RoleInfo, Team, TeamGrant, TeamMember, TeamRole, Upload, UploadCreated, UploadDetail, User,
} from "@/types/api";
import { api, type Query, uploadWithProgress } from "./client";

/** One function per backend endpoint (see docs/api-design.md). */
export const endpoints = {
  // auth
  me: () => api<Me>("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    api<void>("/auth/change-password", { method: "POST", body: { current_password, new_password } }),

  // dashboard
  overview: () => api<Overview>("/stats/overview"),
  health: async (): Promise<Health> => {
    const r = await fetch("/api/health", { cache: "no-store" });
    return r.json();
  },

  // users
  users: (q: Query) => api<Page<User>>("/users", { query: q }),
  user: (id: number) => api<User>(`/users/${id}`),
  createUser: (body: { email: string; display_name: string; role: Role; password?: string }) =>
    api<User>("/users", { method: "POST", body }),
  updateUser: (id: number, body: { display_name?: string; role?: Role }) =>
    api<User>(`/users/${id}`, { method: "PATCH", body }),
  deactivateUser: (id: number) => api<User>(`/users/${id}/deactivate`, { method: "POST" }),
  userTeams: (id: number) => api<MyTeam[]>(`/users/${id}/teams`),
  roles: () => api<RoleInfo[]>("/roles"),
  permissions: () => api<PermissionInfo[]>("/permissions"),
  createRole: (body: { key: string; name: string; description?: string; permissions: string[] }) =>
    api<RoleInfo>("/roles", { method: "POST", body }),
  updateRole: (key: string, body: { name?: string; description?: string; permissions?: string[] }) =>
    api<RoleInfo>(`/roles/${key}`, { method: "PATCH", body }),

  // teams
  teams: (q: Query) => api<Page<Team>>("/teams", { query: q }),
  team: (id: number) => api<Team>(`/teams/${id}`),
  createTeam: (body: { name: string; description?: string }) => api<Team>("/teams", { method: "POST", body }),
  updateTeam: (id: number, body: { name?: string; description?: string; status?: "active" | "archived" }) =>
    api<Team>(`/teams/${id}`, { method: "PATCH", body }),
  teamMembers: (id: number) => api<TeamMember[]>(`/teams/${id}/members`),
  setTeamMember: (id: number, userId: number, team_role: TeamRole) =>
    api<TeamMember>(`/teams/${id}/members/${userId}`, { method: "PUT", body: { team_role } }),
  removeTeamMember: (id: number, userId: number) =>
    api<void>(`/teams/${id}/members/${userId}`, { method: "DELETE" }),
  teamGrants: (id: number) => api<TeamGrant[]>(`/teams/${id}/datasets`),
  setTeamGrant: (id: number, datasetId: number, access_level: AccessLevel) =>
    api<TeamGrant>(`/teams/${id}/datasets/${datasetId}`, { method: "PUT", body: { access_level } }),
  removeTeamGrant: (id: number, datasetId: number) =>
    api<void>(`/teams/${id}/datasets/${datasetId}`, { method: "DELETE" }),
  datasetTeams: (id: number) => api<DatasetTeam[]>(`/datasets/${id}/teams`),

  // datasets
  datasets: (q: Query) => api<Page<Dataset>>("/datasets", { query: q }),
  dataset: (id: number) => api<Dataset>(`/datasets/${id}`),
  createDataset: (body: { name: string; description?: string }) =>
    api<Dataset>("/datasets", { method: "POST", body }),
  updateDataset: (id: number, body: { name?: string; description?: string; status?: "active" | "archived" }) =>
    api<Dataset>(`/datasets/${id}`, { method: "PATCH", body }),
  deleteDataset: (id: number) => api<void>(`/datasets/${id}`, { method: "DELETE" }),
  datasetAccess: (id: number) => api<AccessEntry[]>(`/datasets/${id}/access`),
  setDatasetAccess: (id: number, entries: { user_id: number; access_level: AccessLevel }[]) =>
    api<AccessEntry[]>(`/datasets/${id}/access`, { method: "PUT", body: { entries } }),
  upload: (datasetId: number, file: File, notes: string | undefined, onProgress: (l: number, t: number) => void,
    allowDuplicate = false, purpose: "data" | "suppression" = "data") => {
    const form = new FormData();
    form.append("file", file);
    if (notes) form.append("notes", notes);
    return uploadWithProgress<UploadCreated>(`/datasets/${datasetId}/uploads`, form, onProgress,
      { ...(allowDuplicate ? { allow_duplicate: true } : {}), purpose });
  },

  // uploads
  uploads: (q: Query) => api<Page<Upload>>("/uploads", { query: q }),
  uploadDetail: (id: number) => api<UploadDetail>(`/uploads/${id}`),
  preview: (id: number, rows = 10) => api<Preview>(`/uploads/${id}/preview`, { query: { rows } }),
  columnMapping: (id: number) => api<ColumnMapping>(`/uploads/${id}/column-mapping`),
  setColumnMapping: (id: number, column_mapping: Record<string, string>) =>
    api<Upload>(`/uploads/${id}/column-mapping`, { method: "PUT", body: { column_mapping } }),
  processUpload: (id: number) => api<Job>(`/uploads/${id}/process`, { method: "POST" }),
  cancelUpload: (id: number) => api<Upload>(`/uploads/${id}/cancel`, { method: "POST" }),
  uploadRecords: (id: number, q: Query) => api<Page<RecordItem>>(`/uploads/${id}/records`, { query: q }),

  // jobs
  jobs: (q: Query) => api<Page<Job>>("/jobs", { query: q }),
  job: (id: number) => api<Job>(`/jobs/${id}`),
  retryJob: (id: number) => api<Job>(`/jobs/${id}/retry`, { method: "POST" }),

  // records & masters
  records: (q: Query) => api<Page<RecordItem>>("/records", { query: q }),
  record: (id: number) => api<RecordDetail>(`/records/${id}`),
  recordMatches: (id: number) => api<Match[]>(`/records/${id}/matches`),
  masters: (q: Query) => api<Page<MasterListItem>>("/master-records", { query: q }),
  master: (id: number) => api<MasterDetail>(`/master-records/${id}`),

  // review
  groups: (q: Query) => api<Page<Group>>("/duplicate-groups", { query: q }),
  groupStats: () => api<GroupStats>("/duplicate-groups/stats"),
  group: (id: number) => api<GroupDetail>(`/duplicate-groups/${id}`),
  claimGroup: (id: number) => api<Group>(`/duplicate-groups/${id}/claim`, { method: "POST" }),
  releaseGroup: (id: number) => api<Group>(`/duplicate-groups/${id}/release`, { method: "POST" }),
  decide: (id: number, body: DecisionIn) =>
    api<DecisionResult>(`/duplicate-groups/${id}/decisions`, { method: "POST", body }),
  groupHistory: (id: number) => api<GroupHistory>(`/duplicate-groups/${id}/history`),
  match: (id: number) => api<MatchDetail>(`/matches/${id}`),
  reverseMergeEvent: (id: number, comment?: string) =>
    api<RevertResult>(`/merge-events/${id}/reverse`, { method: "POST", body: { comment } }),

  // audit & exports
  auditLogs: (q: Query) => api<Page<AuditLog>>("/audit-logs", { query: q }),
  verifyAudit: () => api<ChainVerification>("/audit-logs/verify"),
  exports: (q: Query) => api<Page<ExportItem>>("/exports", { query: q }),
  createExport: (body: { export_type: ExportType; file_format: "csv" | "xlsx"; filters: Record<string, string | number | boolean> }) =>
    api<ExportItem>("/exports", { method: "POST", body }),
};
