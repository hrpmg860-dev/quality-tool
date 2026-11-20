"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import type { Dataset } from "@/types/api";

/** Readable datasets (bounded: datasets are few; records are never listed like this). */
export function useDatasets() {
  return useQuery({
    queryKey: ["datasets-all"],
    queryFn: async () => {
      const all: Dataset[] = [];
      let cursor: number | null | undefined;
      for (let i = 0; i < 10; i++) {
        const page = await endpoints.datasets({ limit: 200, cursor: cursor ?? undefined });
        all.push(...page.items);
        cursor = page.next_cursor;
        if (!cursor) break;
      }
      return all;
    },
    staleTime: 60_000,
  });
}

export function DatasetName({ id, link = true }: { id: number | null | undefined; link?: boolean }) {
  const { data } = useDatasets();
  if (id == null) return <span className="text-slate-400">—</span>;
  const name = data?.find((d) => d.id === id)?.name ?? `Dataset #${id}`;
  return link ? <Link href={`/datasets/${id}`} className="text-brand-700 hover:underline">{name}</Link> : <>{name}</>;
}

/** Display name when the viewer may read users (admins), else a stable id. */
export function UserName({ id }: { id: number | null | undefined }) {
  const { me, can } = useAuth();
  const allowed = can(Perm.USER_MANAGE) && id != null && id !== me?.id;
  const { data } = useQuery({
    queryKey: ["user", id], queryFn: () => endpoints.user(id as number), enabled: allowed, staleTime: 300_000,
  });
  if (id == null) return <span className="text-slate-400">System</span>;
  if (id === me?.id) return <span>You</span>;
  return <span title={data?.email}>{data?.display_name ?? `User #${id}`}</span>;
}

export function IdLink({ href, id, prefix = "#" }: { href: string; id: number | null | undefined; prefix?: string }) {
  if (id == null) return <span className="text-slate-400">—</span>;
  return <Link href={href} className="font-mono text-xs text-brand-700 hover:underline">{prefix}{id}</Link>;
}
