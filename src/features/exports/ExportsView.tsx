"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, Plus } from "lucide-react";
import { useState } from "react";
import { Field, FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useDatasets, UserName } from "@/components/ui/entities";
import { EmptyState, InlineError } from "@/components/ui/states";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { downloadUrl } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { dateInputToIso, formatBytes, formatDateTime, formatNumber, humanize } from "@/lib/utils";
import type { ExportItem, ExportType } from "@/types/api";

const TYPE_FIELDS: Record<ExportType, { key: string; label: string; kind: "dataset" | "text" | "date" | "status" | "tier" }[]> = {
  records: [
    { key: "dataset_id", label: "Dataset", kind: "dataset" }, { key: "upload_id", label: "Upload ID", kind: "text" },
    { key: "master_id", label: "Master ID", kind: "text" },
  ],
  master_records: [
    { key: "dataset_id", label: "Dataset", kind: "dataset" },
    { key: "status", label: "Status", kind: "status" },
  ],
  duplicate_groups: [
    { key: "dataset_id", label: "Dataset", kind: "dataset" }, { key: "upload_id", label: "Upload ID", kind: "text" },
    { key: "status", label: "Status", kind: "status" }, { key: "tier", label: "Tier", kind: "tier" },
  ],
  audit_logs: [
    { key: "actor_id", label: "Actor user ID", kind: "text" }, { key: "action", label: "Action (e.g. upload.)", kind: "text" },
    { key: "entity_type", label: "Entity type", kind: "text" }, { key: "entity_id", label: "Entity ID", kind: "text" },
    { key: "occurred_from", label: "From", kind: "date" }, { key: "occurred_to", label: "To", kind: "date" },
  ],
};

function NewExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const datasets = useDatasets();
  const [type, setType] = useState<ExportType>("records");
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () => endpoints.createExport({
      export_type: type, file_format: format,
      filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "").map(([k, v]) => [k, k.endsWith("_id") || k === "entity_id" || k === "actor_id" ? Number(v) : v])) as Record<string, string | number | boolean>,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exports"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setFilters({});
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Request export" size="lg"
      description="Runs asynchronously in a worker — large datasets stream to a file; nothing is loaded into memory. Downloads are audited."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => create.mutate()} loading={create.isPending}><FileDown className="h-4 w-4" />Request export</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="What to export" required>
            {(id) => (
              <Select id={id} value={type} onChange={(e) => { setType(e.target.value as ExportType); setFilters({}); }}>
                <option value="records">Records (raw + normalized)</option>
                <option value="master_records">Master records</option>
                <option value="duplicate_groups">Duplicate groups</option>
                <option value="audit_logs" disabled={!can(Perm.AUDIT_READ)}>Audit logs</option>
              </Select>
            )}
          </Field>
          <Field label="Format" required>
            {(id) => (
              <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as "csv" | "xlsx")}>
                <option value="csv">CSV</option><option value="xlsx">Excel (XLSX)</option>
              </Select>
            )}
          </Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Filters</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TYPE_FIELDS[type].map((f) => (
              <Field key={f.key} label={f.label}>
                {(id) => {
                  if (f.kind === "dataset") {
                    return (
                      <Select id={id} value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}>
                        <option value="">All readable datasets</option>
                        {datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    );
                  }
                  if (f.kind === "date") {
                    return <Input id={id} type="date" value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: dateInputToIso(e.target.value, f.key === "occurred_to") ?? "" })} />;
                  }
                  if (f.kind === "status" && type === "duplicate_groups") {
                    return <Select id={id} value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}><option value="">Any</option><option value="pending">Pending</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="stale">Stale</option></Select>;
                  }
                  if (f.kind === "status" && type === "master_records") {
                    return <Select id={id} value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}><option value="">Any</option><option value="active">Active</option><option value="merged">Merged</option><option value="retired">Retired</option></Select>;
                  }
                  if (f.kind === "tier") {
                    return <Select id={id} value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}><option value="">Any</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></Select>;
                  }
                  return <Input id={id} value={filters[f.key] ?? ""} onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })} />;
                }}
              </Field>
            ))}
          </div>
        </div>
        <InlineError error={create.error} />
      </div>
    </Dialog>
  );
}

export function ExportsView() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const list = usePagedQuery("exports", endpoints.exports, { status: status || undefined },
    { refetchInterval: (items) => (items?.some((e) => e.status === "queued" || e.status === "running") ? 3000 : false) });

  const columns: Column<ExportItem>[] = [
    {
      key: "type", header: "Export", cell: (e) => (
        <div className="min-w-[10rem]">
          <p className="font-medium text-slate-900">{humanize(e.export_type)}</p>
          <p className="font-mono text-[11px] text-slate-400">#{e.id} · {e.file_format.toUpperCase()}</p>
        </div>
      ),
    },
    { key: "filters", header: "Filters", cell: (e) => <span className="font-mono text-xs text-slate-500">{Object.entries(e.filters).map(([k, v]) => `${k}=${v}`).join(" ") || "—"}</span> },
    { key: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} /> },
    { key: "rows", header: "Rows", className: "tabular-nums text-right", headerClassName: "text-right", cell: (e) => formatNumber(e.row_count) },
    { key: "size", header: "Size", className: "tabular-nums whitespace-nowrap", cell: (e) => formatBytes(e.size_bytes) },
    { key: "by", header: "Requested by", cell: (e) => <UserName id={e.requested_by} /> },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (e) => formatDateTime(e.created_at) },
    {
      key: "dl", header: "", headerClassName: "w-28", cell: (e) => (
        e.status === "succeeded"
          ? <a href={downloadUrl(`/exports/${e.id}/download`)} className={buttonClass("secondary", "sm")}><Download className="h-3.5 w-3.5" />Download</a>
          : e.error_summary ? <span className="text-xs text-red-600" title={e.error_summary}>Error</span> : <span className="text-slate-300">—</span>
      ),
    },
  ];

  return (
    <RequirePerm allowed={can(Perm.EXPORT_CREATE)}>
      <PageHeader title="Reports & exports" description="Async CSV/XLSX exports of records, masters, duplicate groups and the audit trail — streamed, never held in browser memory."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New export</Button>} />
      <Card>
        <TableToolbar>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any</option><option value="queued">Queued</option><option value="running">Running</option><option value="succeeded">Succeeded</option><option value="failed">Failed</option>
              </Select>
            )}
          </FilterField>
        </TableToolbar>
        <DataTable caption="Exports" columns={columns} rows={list.items} rowKey={(e) => e.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()}
          empty={<EmptyState icon={<FileDown className="h-6 w-6" />} title="No exports yet" description="Request one to download filtered data as CSV or Excel." />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>
      {creating && <NewExportDialog open onClose={() => setCreating(false)} />}
    </RequirePerm>
  );
}
