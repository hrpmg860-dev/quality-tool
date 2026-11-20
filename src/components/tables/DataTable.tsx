"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import type { CursorPager } from "@/hooks/useCursorPager";
import { cn } from "@/lib/utils";
import type { Order } from "@/types/api";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Server-side sortable (keyset `order=newest|oldest`). */
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  order?: Order;
  onOrderChange?: (o: Order) => void;
  rowClassName?: (row: T) => string | undefined;
  caption?: string;
}

export function DataTable<T>({
  columns, rows, rowKey, isLoading, isFetching, error, onRetry, empty, order, onOrderChange, rowClassName, caption,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  return (
    <div className="relative overflow-x-auto">
      {isFetching && !isLoading && (
        <div className="absolute right-3 top-2.5 z-10 text-slate-400" aria-label="Refreshing"><Spinner className="h-3.5 w-3.5" /></div>
      )}
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col"
                aria-sort={c.sortable && order ? (order === "newest" ? "descending" : "ascending") : undefined}
                className={cn("whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", c.headerClassName)}>
                {c.sortable && onOrderChange ? (
                  <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800"
                    onClick={() => onOrderChange(order === "newest" ? "oldest" : "newest")}
                    title={order === "newest" ? "Newest first — click for oldest first" : "Oldest first — click for newest first"}>
                    {c.header}
                    {order === "oldest" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  </button>
                ) : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {isLoading
            ? Array.from({ length: 6 }, (_, i) => (
              <tr key={i}>
                {columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[10rem]" /></td>)}
              </tr>
            ))
            : rows?.map((r) => (
              <tr key={rowKey(r)} className={cn("hover:bg-slate-50/70", rowClassName?.(r))}>
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-2.5 align-middle text-slate-700", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
      {!isLoading && rows && rows.length === 0 && (empty ?? <EmptyState title="No results" description="Try adjusting your filters." />)}
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50, 100];

/** Prev/Next keyset pagination footer. */
export function Pagination({ pager, nextCursor, count, isFetching }: {
  pager: CursorPager; nextCursor: number | null | undefined; count: number | undefined; isFetching?: boolean;
}) {
  const from = (pager.page - 1) * pager.pageSize + (count ? 1 : 0);
  const to = (pager.page - 1) * pager.pageSize + (count ?? 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <label htmlFor="page-size" className="text-xs text-slate-500">Rows per page</label>
        <select id="page-size" value={pager.pageSize} onChange={(e) => pager.setPageSize(Number(e.target.value))}
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-slate-500">
          {count ? `${from}–${to}` : "0"} · page {pager.page}
        </span>
        <div className="flex gap-1">
          <button aria-label="Previous page" disabled={!pager.hasPrev || isFetching} onClick={pager.prev}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button aria-label="Next page" disabled={!nextCursor || isFetching} onClick={() => nextCursor && pager.next(nextCursor)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 px-4 py-3">{children}</div>;
}
