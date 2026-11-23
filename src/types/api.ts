/** DTOs mirroring backend/app/schemas (FastAPI). Timestamps are ISO strings. */

export interface Page<T> {
  items: T[];
  next_cursor: number | null;
}

export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string | null;
  code?: string;
  request_id?: string | null;
  [extra: string]: unknown;
}

/** System roles; custom roles (created via the roles API) are any other key. */
export type SystemRole = "super_admin" | "admin" | "manager" | "reviewer" | "viewer";
export type Role = SystemRole | (string & {});
export type AccessLevel = "read" | "upload" | "review" | "manage";
export type TeamRole = "member" | "lead";
export type Order = "newest" | "oldest";

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: Role;
  status: "active" | "deactivated" | "invited";
  auth_provider: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MyTeam {
  id: number;
  name: string;
  status: "active" | "archived";
  team_role: TeamRole;
}

export interface Me extends User {
  is_admin: boolean;
  role_name: string;
  permissions: string[];
  /** Effective level per dataset: max(direct grant, active-team grants). */
  dataset_access: Record<string, AccessLevel>;
  teams: MyTeam[];
}

export interface RoleInfo {
  role: Role;
  name: string;
  description: string | null;
  is_system: boolean;
  is_admin: boolean;
  editable: boolean;
  permissions: string[];
  user_count: number | null;
}

export interface PermissionInfo {
  key: string;
  category: string;
  description: string;
}

export interface Team {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_by: number | null;
  created_at: string;
  updated_at: string;
  member_count: number | null;
  my_team_role: TeamRole | null;
}

export interface TeamMember {
  user_id: number;
  email: string;
  display_name: string;
  role: Role;
  status: User["status"];
  team_role: TeamRole;
  added_by: number | null;
  created_at: string;
}

export interface TeamGrant {
  team_id: number;
  dataset_id: number;
  access_level: AccessLevel;
  granted_by: number | null;
  updated_at: string;
}

export interface DatasetTeam {
  team_id: number;
  team_name: string;
  team_status: "active" | "archived";
  access_level: AccessLevel;
  granted_by: number | null;
  updated_at: string;
}

export interface Dataset {
  id: number;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_by: number | null;
  created_at: string;
  updated_at: string;
  my_access_level: AccessLevel | null;
  upload_count: number | null;
}

export interface AccessEntry {
  user_id: number;
  access_level: AccessLevel;
  granted_by: number | null;
  updated_at: string;
}

export type UploadStatus = "uploaded" | "mapped" | "processing" | "completed" | "failed" | "cancelled";

export interface Upload {
  id: number;
  dataset_id: number;
  original_filename: string;
  storage_backend: string;
  sha256: string;
  size_bytes: number;
  mime_type: string | null;
  file_format: string;
  purpose: "data" | "suppression";
  status: UploadStatus;
  row_count: number;
  error_count: number;
  uploaded_by: number;
  column_mapping: Record<string, string> | null;
  processed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadCreated extends Upload {
  duplicate_of_upload_ids: number[];
}

export type JobStatus = "queued" | "running" | "retrying" | "succeeded" | "failed" | "cancelled";

export interface Job {
  id: number;
  upload_id: number | null;
  job_type: string;
  status: JobStatus;
  stage: string | null;
  progress_pct: number;
  celery_task_id: string | null;
  attempts: number;
  error_summary: string | null;
  stats: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
}

export interface UploadDetail extends Upload {
  source_headers: Record<string, string[]> | null;
  record_count: number;
  groups_by_status: Record<string, number>;
  jobs: Job[];
}

export type CanonicalField = "first_name" | "last_name" | "full_name" | "email" | "linkedin_url";

export interface ColumnMapping {
  upload_id: number;
  headers: string[];
  column_mapping: Record<string, string> | null;
  suggested_mapping: Record<string, string>;
}

export interface Preview {
  upload_id: number;
  sheets: { sheet_name: string | null; headers: string[]; rows: { row_number: number; values: Record<string, string> }[] }[];
  suggested_mapping: Record<string, string>;
  column_mapping: Record<string, string> | null;
}

export interface Normalized {
  normalization_version: string;
  first_name_norm: string | null;
  last_name_norm: string | null;
  full_name_norm: string | null;
  email_norm: string | null;
  email_domain: string | null;
  linkedin_slug: string | null;
  quality_flags: Record<string, unknown>;
}

export interface RecordItem {
  id: number;
  dataset_id: number;
  current_master_id: number | null;
  redacted: boolean;
  upload_id?: number | null;
  source_filename?: string | null;
  uploaded_by?: number | null;
  row_number?: number | null;
  sheet_name?: string | null;
  raw_data?: Record<string, string> | null;
  raw_row_hash?: string | null;
  ingested_at?: string | null;
  normalized?: Normalized | null;
  similarity?: number | null;
}

export interface Link {
  id: number;
  master_record_id: number;
  record_id: number;
  valid_from: string;
  valid_to: string | null;
  created_by_event_id: number | null;
  ended_by_event_id: number | null;
}

export interface RecordDetail extends RecordItem {
  link_history: Link[];
}

export type Tier = "high" | "medium" | "low";
export type Scope = "intra_file" | "cross_file" | "historical" | "suppression" | "mixed";

export interface Match {
  id: number;
  group_id: number;
  record_a_id: number;
  record_b_id: number;
  score: string | number;
  tier: Tier;
  scope: Scope;
  status: "pending" | "confirmed" | "rejected" | "superseded";
  evidence: Record<string, unknown>;
  created_at: string;
}

export interface MatchDetail extends Match {
  record_a: RecordItem | null;
  record_b: RecordItem | null;
}

export interface Master {
  id: number;
  status: "active" | "merged" | "retired";
  merged_into_id: number | null;
  golden_first_name: string | null;
  golden_last_name: string | null;
  golden_full_name: string | null;
  primary_email: string | null;
  linkedin_url: string | null;
  version: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MasterListItem extends Master {
  active_record_count: number;
}

export interface MergeEvent {
  id: number;
  event_type: string;
  actor_id: number | null;
  review_decision_id: number | null;
  master_record_id: number | null;
  target_master_id: number | null;
  reverses_event_id: number | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface MasterDetail extends Master {
  source_records: RecordItem[];
  former_records: RecordItem[];
  links: Link[];
  history: MergeEvent[];
}

export type GroupStatus = "pending" | "in_review" | "resolved" | "stale";
export type DecisionType = "approve" | "reject" | "split" | "defer";
/** Decision rows can also record merge reversals (unmerge). */
export type DecisionOutcome = DecisionType | "unmerge";

export interface Group {
  id: number;
  anchor_record_id: number | null;
  proposed_master_id: number | null;
  upload_id: number | null;
  status: GroupStatus;
  confidence_tier: Tier;
  scope: Scope;
  rule_set_version: string;
  version: number;
  multi_master_conflict: boolean;
  evidence_summary: Record<string, unknown> | null;
  assigned_to: number | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: number;
  group_id: number;
  reviewer_id: number;
  decision: DecisionOutcome;
  member_decisions: Record<string, unknown>;
  comment: string | null;
  group_version_seen: number;
  created_at: string;
}

export interface GroupDetail extends Group {
  dataset_id: number | null;
  matches: Match[];
  records: RecordItem[];
  proposed_master: Master | null;
  candidate_masters: Master[];
  decisions: Decision[];
}

export interface GroupStats {
  total: number;
  by_status: Record<string, number>;
  by_status_and_tier: Record<string, Record<string, number>>;
}

export interface DecisionIn {
  decision: DecisionType;
  group_version_seen: number;
  member_decisions?: Record<string, "approve" | "reject">;
  target_master_id?: number;
  /** Golden-field survivorship picks: field -> source master id. */
  field_selections?: Record<string, number>;
  comment?: string;
}

export interface DecisionResult {
  decision: Decision;
  group: Group;
  merge_events: MergeEvent[];
}

export interface RevertResult {
  decision: Decision;
  merge_event: MergeEvent;
}

export interface GroupHistory {
  group_id: number;
  decisions: Decision[];
  merge_events: MergeEvent[];
}

export interface AuditLog {
  id: number;
  occurred_at: string;
  actor_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  before_data: unknown;
  after_data: unknown;
  prev_hash: string | null;
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  checked: number;
  broken_at_id: number | null;
  reason: string | null;
}

export type ExportType = "records" | "master_records" | "duplicate_groups" | "audit_logs";

export interface ExportItem {
  id: number;
  requested_by: number;
  export_type: ExportType;
  file_format: "csv" | "xlsx";
  status: "queued" | "running" | "succeeded" | "failed";
  filters: Record<string, string | number | boolean>;
  job_id: number | null;
  filename: string | null;
  sha256: string | null;
  size_bytes: number | null;
  row_count: number | null;
  error_summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Overview {
  datasets: number;
  uploads: { total: number; by_status: Record<string, number> };
  records: number | null;
  active_masters: number | null;
  groups: GroupStats | null;
  jobs_by_status: Record<string, number>;
}

export interface Health {
  status: string;
  checks: Record<string, string>;
}
