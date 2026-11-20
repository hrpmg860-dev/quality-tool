"use client";

import Link from "next/link";
import { type Column, DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { DatasetName, IdLink } from "@/components/ui/entities";
import type { CursorPager } from "@/hooks/useCursorPager";
import { formatDateTime, recordDisplayName } from "@/lib/utils";
import type { RecordItem } from "@/types/api";

export function recordColumns(opts: { showDataset?: boolean; showSimilarity?: boolean } = {}): Column<RecordItem>[] {
  return [
    { key: "id", header: "Record", cell: (r) => <IdLink href={`/records/${r.id}`} id={r.id} /> },
    {
      key: "name", header: "Name", cell: (r) => (
        <Link href={`/records/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">{recordDisplayName(r)}</Link>
      ),
    },
    { key: "email", header: "Email (normalized)", cell: (r) => r.normalized?.email_norm ?? <span className="text-slate-400">—</span> },
    { key: "linkedin", header: "LinkedIn", cell: (r) => r.normalized?.linkedin_slug ?? <span className="text-slate-400">—</span> },
    ...(opts.showSimilarity ? [{
      key: "sim", header: "Name similarity", className: "tabular-nums",
      cell: (r: RecordItem) => (r.similarity != null ? <Badge tone={r.similarity >= 0.7 ? "green" : "amber"}>{(r.similarity * 100).toFixed(0)}%</Badge> : "—"),
    }] : []),
    {
      key: "source", header: "Source", cell: (r) => (
        <div className="max-w-[16rem]">
          <Link href={`/uploads/${r.upload_id}`} className="block truncate text-slate-700 hover:text-brand-700">{r.source_filename}</Link>
          <p className="text-[11px] text-slate-400">{r.sheet_name ? `${r.sheet_name} · ` : ""}row {r.row_number}</p>
        </div>
      ),
    },
    ...(opts.showDataset ? [{ key: "ds", header: "Dataset", cell: (r: RecordItem) => <DatasetName id={r.dataset_id} /> }] : []),
    { key: "master", header: "Master", cell: (r) => <IdLink href={`/masters/${r.current_master_id}`} id={r.current_master_id} prefix="M-" /> },
    { key: "ingested", header: "Ingested", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.ingested_at) },
  ];
}

export function RecordsTable({ rows, isLoading, isFetching, error, onRetry, pager, nextCursor, empty, showDataset, showSimilarity }: {
  rows: RecordItem[] | undefined; isLoading: boolean; isFetching: boolean; error: unknown; onRetry: () => void;
  pager: CursorPager; nextCursor: number | null | undefined; empty?: React.ReactNode; showDataset?: boolean; showSimilarity?: boolean;
}) {
  return (
    <>
      <DataTable caption="Records" columns={recordColumns({ showDataset, showSimilarity })} rows={rows} rowKey={(r) => r.id}
        isLoading={isLoading} isFetching={isFetching} error={error} onRetry={onRetry} empty={empty} />
      <Pagination pager={pager} nextCursor={nextCursor} count={rows?.length} isFetching={isFetching} />
    </>
  );
}
