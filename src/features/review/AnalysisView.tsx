"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, GitCompareArrows, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { GroupsTable } from "@/features/review/ReviewQueueView";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { cn, formatNumber, humanize } from "@/lib/utils";

const STATUSES = ["pending", "in_review", "resolved", "stale"] as const;
const TIERS = ["high", "medium", "low"] as const;
const TIER_BAR = { high: "bg-emerald-500", medium: "bg-amber-500", low: "bg-red-500" } as const;
const STATUS_TONE = { pending: "amber", in_review: "brand", resolved: "green", stale: "slate" } as const;

export function AnalysisView() {
  const { can } = useAuth();
  const stats = useQuery({ queryKey: ["group-stats"], queryFn: endpoints.groupStats, enabled: can(Perm.GROUP_READ), refetchInterval: 30_000 });
  const s = stats.data;
  const total = s?.total ?? 0;
  const open = (s?.by_status.pending ?? 0) + (s?.by_status.in_review ?? 0);
  const resolved = s?.by_status.resolved ?? 0;
  const highConflicts = (s?.by_status_and_tier.pending?.high ?? 0) + (s?.by_status_and_tier.in_review?.high ?? 0);

  return (
    <RequirePerm allowed={can(Perm.GROUP_READ)}>
      <PageHeader
        title="Duplicate analysis"
        description="Queue health across your readable datasets — group counts by status and matcher confidence tier."
        actions={<Link href="/review" className="text-sm font-medium text-brand-600 hover:text-brand-700">Go to review center →</Link>}
      />

      {stats.error ? <Card><ErrorState error={stats.error} onRetry={() => stats.refetch()} /></Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total groups" value={s ? formatNumber(total) : <Skeleton className="h-7 w-14" />} icon={<GitCompareArrows className="h-5 w-5" />} />
            <StatCard label="Awaiting review" value={s ? formatNumber(open) : <Skeleton className="h-7 w-14" />} tone="amber" icon={<ShieldCheck className="h-5 w-5" />} />
            <StatCard label="Resolved" value={s ? formatNumber(resolved) : <Skeleton className="h-7 w-14" />} tone="green" icon={<CheckCircle2 className="h-5 w-5" />}
              hint={total ? `${Math.round((resolved / total) * 100)}% of all groups` : undefined} />
            <StatCard label="High-tier open" value={s ? formatNumber(highConflicts) : <Skeleton className="h-7 w-14" />} tone="red" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Queue by status" description="Distribution of all duplicate groups" />
              <CardBody className="space-y-4">
                {!s && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                {s && STATUSES.map((st) => {
                  const n = s.by_status[st] ?? 0;
                  return (
                    <div key={st}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <Link href={`/review?status=${st}`} className="font-medium text-slate-700 hover:text-brand-700">{humanize(st)}</Link>
                        <span className="tabular-nums text-slate-500">{formatNumber(n)} <span className="text-slate-400">({total ? Math.round((n / total) * 100) : 0}%)</span></span>
                      </div>
                      <ProgressBar value={total ? (n / total) * 100 : 0} tone={STATUS_TONE[st] === "slate" ? "brand" : STATUS_TONE[st]} label={`${st} share`} />
                    </div>
                  );
                })}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Status × confidence tier" description="Where each group sits" />
              <CardBody>
                {!s ? <Skeleton className="h-32 w-full" /> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th scope="col" className="pb-2 pr-3">Status</th>
                          {TIERS.map((t) => <th key={t} scope="col" className="pb-2 pr-3 text-right">{humanize(t)}</th>)}
                          <th scope="col" className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {STATUSES.map((st) => (
                          <tr key={st}>
                            <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-700">{humanize(st)}</th>
                            {TIERS.map((t) => {
                              const n = s.by_status_and_tier[st]?.[t] ?? 0;
                              return (
                                <td key={t} className="py-2 pr-3 text-right tabular-nums">
                                  {n ? <Link href={`/review?status=${st}&tier=${t}`} className="text-brand-700 hover:underline">{formatNumber(n)}</Link> : <span className="text-slate-300">0</span>}
                                </td>
                              );
                            })}
                            <td className="py-2 text-right font-semibold tabular-nums text-slate-800">{formatNumber(s.by_status[st] ?? 0)}</td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-200 font-semibold">
                          <th scope="row" className="py-2 pr-3 text-left">Total</th>
                          {TIERS.map((t) => (
                            <td key={t} className="py-2 pr-3 text-right tabular-nums">{formatNumber(STATUSES.reduce((a, st) => a + (s.by_status_and_tier[st]?.[t] ?? 0), 0))}</td>
                          ))}
                          <td className="py-2 text-right tabular-nums">{formatNumber(total)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-4 flex gap-4 text-xs text-slate-500">
                      {TIERS.map((t) => <span key={t} className="flex items-center gap-1.5"><span className={cn("h-2.5 w-2.5 rounded-sm", TIER_BAR[t])} />{humanize(t)} confidence</span>)}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader title="All duplicate groups" />
        <GroupsTable />
      </Card>
    </RequirePerm>
  );
}
