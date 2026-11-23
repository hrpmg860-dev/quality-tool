"use client";

import { useQuery } from "@tanstack/react-query";
import { GitCompareArrows, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FilterField, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { UserName, useDatasets } from "@/components/ui/entities";
import { EmptyState } from "@/components/ui/states";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";
import type { Group, Order } from "@/types/api";

const STATUSES = ["pending", "in_review", "resolved", "stale"];
const TIERS = ["high", "medium", "low"];
const SCOPES = ["suppression", "cross_file", "historical", "intra_file", "mixed"];

export function GroupsTable({ fixed = {}, compact = false }: { fixed?: { dataset_id?: number; upload_id?: number }; compact?: boolean }) {
  const { me } = useAuth();
  const datasets = useDatasets();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [outcome, setOutcome] = useState("");
  const [tier, setTier] = useState(params.get("tier") ?? "");
  const [scope, setScope] = useState("");
  const [dataset, setDataset] = useState("");
  const [conflictOnly, setConflictOnly] = useState(false);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [order, setOrder] = useState<Order>("newest");

  const list = usePagedQuery("groups", endpoints.groups, {
    status: status || undefined, decision: outcome || undefined, tier: tier || undefined,
    scope: scope || undefined,
    dataset_id: fixed.dataset_id ?? (dataset || undefined), upload_id: fixed.upload_id,
    multi_master_conflict: conflictOnly || undefined, assigned_to: assignedToMe ? me?.id : undefined,
    order,
  });

  const columns: Column<Group>[] = [
    {
      key: "id", header: "Group", cell: (g) => (
        <Link href={`/review/${g.id}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline" data-testid="group-link">#{g.id}</Link>
      ),
    },
    { key: "tier", header: "Confidence", cell: (g) => <StatusBadge status={g.confidence_tier} label={`${humanize(g.confidence_tier)}`} /> },
    { key: "status", header: "Status", cell: (g) => <StatusBadge status={g.status} /> },
    { key: "scope", header: "Scope", cell: (g) => <Badge tone="gray">{humanize(g.scope)}</Badge> },
    {
      key: "flags", header: "Flags", cell: (g) => (
        <span className="flex gap-1.5">
          {g.multi_master_conflict && <Badge tone="red" className="whitespace-nowrap">multi-master</Badge>}
          {g.assigned_to && <Badge tone="blue">claimed</Badge>}
          {!g.multi_master_conflict && !g.assigned_to && <span className="text-slate-400">—</span>}
        </span>
      ),
    },
    { key: "upload", header: "Source", cell: (g) => <GroupDatasetName g={g} /> },
    { key: "assignee", header: "Reviewer", cell: (g) => <UserName id={g.assigned_to} /> },
    { key: "created", header: "Created", sortable: true, className: "whitespace-nowrap", cell: (g) => formatDateTime(g.created_at) },
    { key: "rules", header: "Rules", className: "text-xs text-slate-400", cell: (g) => g.rule_set_version },
  ];

  return (
    <>
      {!compact && (
        <TableToolbar>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any status</option>
                <option value="pending,in_review">Unresolved</option>
                {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Outcome">
            {(id) => (
              <Select id={id} value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">Any outcome</option>
                <option value="approve">Approved</option>
                <option value="reject">Rejected</option>
                <option value="split">Split</option>
                <option value="defer">Deferred</option>
                <option value="unmerge">Unmerged</option>
              </Select>
            )}
          </FilterField>
          <FilterField label="Confidence tier">
            {(id) => (
              <Select id={id} value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Any tier</option>
                {TIERS.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Scope">
            {(id) => (
              <Select id={id} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">Any scope</option>
                {SCOPES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
              </Select>
            )}
          </FilterField>
          {!fixed.dataset_id && (
            <FilterField label="Dataset">
              {(id) => (
                <Select id={id} value={dataset} onChange={(e) => setDataset(e.target.value)}>
                  <option value="">All datasets</option>
                  {datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              )}
            </FilterField>
          )}
          <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="rounded border-slate-300" checked={conflictOnly} onChange={(e) => setConflictOnly(e.target.checked)} />
            Multi-master only
          </label>
          <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="rounded border-slate-300" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />
            Assigned to me
          </label>
        </TableToolbar>
      )}
      <DataTable
        caption="Duplicate groups"
        columns={columns}
        rows={list.items}
        rowKey={(g) => g.id}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        order={order}
        onOrderChange={setOrder}
        empty={<EmptyState icon={<GitCompareArrows className="h-6 w-6" />} title="No duplicate groups" description="Groups the matcher finds will land here for review." />}
      />
      <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
    </>
  );
}

function GroupDatasetName({ g }: { g: Group }) {
  // GroupOut carries upload_id only (dataset is derived server-side for ACL);
  // link to the upload, where the dataset is shown.
  return g.upload_id
    ? <Link href={`/uploads/${g.upload_id}`} className="text-slate-600 hover:text-brand-700">upload #{g.upload_id}</Link>
    : <span className="text-slate-400">—</span>;
}

export function ReviewQueueView() {
  const { can } = useAuth();
  const stats = useQuery({ queryKey: ["group-stats"], queryFn: endpoints.groupStats, enabled: can(Perm.GROUP_READ), refetchInterval: 30_000 });
  const s = stats.data;
  return (
    <RequirePerm allowed={can(Perm.GROUP_READ)}>
      <PageHeader title="Duplicate review center" description="Every merge into a master record requires a human decision here — nothing auto-merges." />
      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Pending" value={formatNumber(s.by_status.pending ?? 0)} tone="amber" icon={<ShieldCheck className="h-5 w-5" />} />
          <StatCard label="In review" value={formatNumber(s.by_status.in_review ?? 0)} tone="brand" icon={<GitCompareArrows className="h-5 w-5" />} />
          <StatCard label="Resolved" value={formatNumber(s.by_status.resolved ?? 0)} tone="green" icon={<ShieldCheck className="h-5 w-5" />} />
          <StatCard label="Stale" value={formatNumber(s.by_status.stale ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} />
        </div>
      )}
      <Card><GroupsTable /></Card>
    </RequirePerm>
  );
}
