"use client";

import { Search, Upload as UploadIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatasetName, UserName, useDatasets } from "@/components/ui/entities";
import { EmptyState } from "@/components/ui/states";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { dateInputToIso, formatBytes, formatDateTime, formatNumber } from "@/lib/utils";
import type { Order, Upload } from "@/types/api";

const STATUSES = ["uploaded", "mapped", "processing", "completed", "failed", "cancelled"];

/** Reusable upload table (history screen + dataset detail). */
export function UploadsTable({ datasetId, showDatasetFilter = true }: { datasetId?: number; showDatasetFilter?: boolean }) {
  const { me } = useAuth();
  const datasets = useDatasets();
  const [q, setQ] = useState("");
  const [dataset, setDataset] = useState(datasetId ? String(datasetId) : "");
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<Order>("newest");
  const dq = useDebounced(q);

  const list = usePagedQuery("uploads", endpoints.uploads, {
    q: dq, dataset_id: dataset || undefined, status: status || undefined, uploaded_by: mine ? me?.id : undefined,
    created_from: dateInputToIso(from), created_to: dateInputToIso(to, true), order,
  }, { refetchInterval: (items) => (items?.some((u) => u.status === "processing") ? 4000 : false) });

  const columns: Column<Upload>[] = [
    {
      key: "file", header: "File", cell: (u) => (
        <div className="min-w-[12rem]">
          <Link href={`/uploads/${u.id}`} className="font-medium text-slate-900 hover:text-brand-700">{u.original_filename}</Link>
          <p className="font-mono text-[11px] text-slate-400">#{u.id} · {u.file_format.toUpperCase()}</p>
        </div>
      ),
    },
    ...(showDatasetFilter ? [{ key: "dataset", header: "Dataset", cell: (u: Upload) => <DatasetName id={u.dataset_id} /> }] : []),
    { key: "purpose", header: "Type", cell: (u) => u.purpose === "suppression" ? <Badge tone="amber">suppression</Badge> : <Badge tone="gray">data</Badge> },
    { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "rows", header: "Rows", className: "tabular-nums text-right", headerClassName: "text-right", cell: (u) => formatNumber(u.row_count) },
    {
      key: "errors", header: "Errors", className: "tabular-nums text-right", headerClassName: "text-right",
      cell: (u) => <span className={u.error_count ? "font-medium text-red-600" : "text-slate-400"}>{formatNumber(u.error_count)}</span>,
    },
    { key: "size", header: "Size", className: "tabular-nums whitespace-nowrap", cell: (u) => formatBytes(u.size_bytes) },
    { key: "by", header: "Uploaded by", cell: (u) => <UserName id={u.uploaded_by} /> },
    { key: "created", header: "Uploaded", sortable: true, className: "whitespace-nowrap", cell: (u) => formatDateTime(u.created_at) },
  ];

  return (
    <>
      <TableToolbar>
        <FilterField label="Filename" className="min-w-[14rem] flex-1">
          {(id) => (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input id={id} className="pl-8" placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
        </FilterField>
        {showDatasetFilter && (
          <FilterField label="Dataset">
            {(id) => (
              <Select id={id} value={dataset} onChange={(e) => setDataset(e.target.value)}>
                <option value="">All datasets</option>
                {datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
          </FilterField>
        )}
        <FilterField label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          )}
        </FilterField>
        <FilterField label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</FilterField>
        <FilterField label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</FilterField>
        <label className="flex h-9 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded border-slate-300" />
          Only mine
        </label>
      </TableToolbar>
      <DataTable
        caption="Uploads"
        columns={columns}
        rows={list.items}
        rowKey={(u) => u.id}
        isLoading={list.isLoading}
        isFetching={list.isFetching}
        error={list.error}
        onRetry={() => list.refetch()}
        order={order}
        onOrderChange={setOrder}
        empty={<EmptyState icon={<UploadIcon className="h-6 w-6" />} title="No uploads match" description="Change the filters or upload a new file." />}
      />
      <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
    </>
  );
}

export function UploadHistoryView() {
  const { can } = useAuth();
  return (
    <RequirePerm allowed={can(Perm.UPLOAD_READ)}>
      <PageHeader
        title="Upload history"
        description="Every file ever uploaded to your datasets. Originals are immutable and downloadable."
        actions={can(Perm.UPLOAD_CREATE) && <ButtonLink href="/uploads/new"><UploadIcon className="h-4 w-4" />Upload dataset</ButtonLink>}
      />
      <Card><UploadsTable /></Card>
    </RequirePerm>
  );
}
