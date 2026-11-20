"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Query } from "@/lib/api/client";
import type { Page } from "@/types/api";
import { useCursorPager } from "./useCursorPager";

/**
 * Server-side paginated list: filters + cursor + page size go to the API;
 * only the current page is held client-side.
 */
export function usePagedQuery<T>(
  key: string, fetcher: (q: Query) => Promise<Page<T>>, filters: Query,
  opts: { enabled?: boolean; pageSize?: number; refetchInterval?: number | false | ((items: T[] | undefined) => number | false) } = {},
) {
  const filterKey = JSON.stringify(filters);
  const pager = useCursorPager(filterKey, opts.pageSize ?? 25);
  const query = useQuery({
    queryKey: [key, filters, pager.cursor ?? null, pager.pageSize],
    queryFn: () => fetcher({ ...filters, cursor: pager.cursor, limit: pager.pageSize }),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
    refetchInterval: typeof opts.refetchInterval === "function"
      ? (q) => (opts.refetchInterval as (i: T[] | undefined) => number | false)(q.state.data?.items)
      : opts.refetchInterval,
  });
  return { ...query, pager, items: query.data?.items, nextCursor: query.data?.next_cursor };
}
