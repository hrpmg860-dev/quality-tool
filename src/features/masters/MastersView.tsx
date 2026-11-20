"use client";

import { GitMerge, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useDatasets } from "@/components/ui/entities";
import { EmptyState } from "@/components/ui/states";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { formatDateTime, formatNumber, masterName } from "@/lib/utils";
import type { MasterListItem, Order } from "@/types/api";

export function MastersView() {
  const { can } = useAuth();
  const datasets = useDatasets();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [dataset, setDataset] = useState("");
  const [order, setOrder] = useState<Order>("newest");
  const dq = useDebounced(q);

  const list = usePagedQuery("masters", endpoints.masters, {
    q: dq, status: status || undefined, dataset_id: dataset || undefined, order,
  }, { enabled: can(Perm.MASTER_READ) });

  const columns: Column<MasterListItem>[] = [
    {
      key: "master", header: "Master record", cell: (m) => (
        <div className="min-w-[12rem]">
          <Link href={`/masters/${m.id}`} className="font-medium text-slate-900 hover:text-brand-700" data-testid="master-link">{masterName(m)}</Link>
          <p className="font-mono text-[11px] text-slate-400">M-{m.id}</p>
        </div>
      ),
    },
    { key: "email", header: "Email", cell: (m) => m.primary_email ?? <span className="text-slate-400">—</span> },
    {
      key: "linkedin", header: "LinkedIn", cell: (m) => (m.linkedin_url
        ? <a href={m.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{m.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}</a>
        : <span className="text-slate-400">—</span>),
    },
    { key: "status", header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
    {
      key: "sources", header: "Source records", className: "tabular-nums", cell: (m) => (
        <span className={m.active_record_count > 1 ? "font-semibold text-brand-700" : ""}>{formatNumber(m.active_record_count)}</span>
      ),
    },
    { key: "mergedinto", header: "Merged into", cell: (m) => (m.merged_into_id ? <Link href={`/masters/${m.merged_into_id}`} className="font-mono text-xs text-brand-700">M-{m.merged_into_id}</Link> : "—") },
    { key: "version", header: "Ver.", className: "tabular-nums", cell: (m) => `v${m.version}` },
    { key: "updated", header: "Updated", sortable: true, className: "whitespace-nowrap", cell: (m) => formatDateTime(m.updated_at) },
  ];

  return (
    <RequirePerm allowed={can(Perm.MASTER_READ)}>
      <PageHeader title="Master records" description="Golden records built by approved merges. Each links to its source records and full merge lineage." />
      <Card>
        <TableToolbar>
          <FilterField label="Search" className="min-w-[14rem] flex-1">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input id={id} className="pl-8" placeholder="Name, email or master ID…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
          </FilterField>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any</option><option value="active">Active</option><option value="merged">Merged</option><option value="retired">Retired</option>
              </Select>
            )}
          </FilterField>
          <FilterField label="Dataset">
            {(id) => (
              <Select id={id} value={dataset} onChange={(e) => setDataset(e.target.value)}>
                <option value="">All datasets</option>
                {datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
          </FilterField>
        </TableToolbar>
        <DataTable caption="Master records" columns={columns} rows={list.items} rowKey={(m) => m.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()} order={order} onOrderChange={setOrder}
          empty={<EmptyState icon={<GitMerge className="h-6 w-6" />} title="No master records" description="Masters appear as uploads are ingested and merges approved." />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>
    </RequirePerm>
  );
}
