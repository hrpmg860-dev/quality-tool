"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, FileStack, GitMerge, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { DatasetName } from "@/components/ui/entities";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { formatNumber, humanize, relativeTime } from "@/lib/utils";
import type { Job } from "@/types/api";

const ACTIVE_JOB = new Set(["queued", "running", "retrying"]);
const TIERS = ["high", "medium", "low"] as const;
const TIER_TONE = { high: "green", medium: "amber", low: "red" } as const;

export function DashboardView() {
  const { me, can } = useAuth();
  const overview = useQuery({ queryKey: ["overview"], queryFn: endpoints.overview, refetchInterval: 30_000 });
  const uploads = useQuery({
    queryKey: ["uploads", "recent"], queryFn: () => endpoints.uploads({ limit: 6 }), enabled: can(Perm.UPLOAD_READ),
    refetchInterval: (q) => (q.state.data?.items.some((u) => u.status === "processing") ? 4000 : false),
  });
  const jobs = useQuery({
    queryKey: ["jobs", "recent"], queryFn: () => endpoints.jobs({ limit: 6 }), enabled: can(Perm.JOB_READ),
    refetchInterval: (q) => (q.state.data?.items.some((j: Job) => ACTIVE_JOB.has(j.status)) ? 3000 : false),
  });

  const o = overview.data;
  const pending = (o?.groups?.by_status.pending ?? 0) + (o?.groups?.by_status.in_review ?? 0);
  const resolved = o?.groups?.by_status.resolved ?? 0;
  const pendingByTier = TIERS.map((t) => ({
    tier: t,
    n: (o?.groups?.by_status_and_tier.pending?.[t] ?? 0) + (o?.groups?.by_status_and_tier.in_review?.[t] ?? 0),
  }));

  return (
    <>
      <PageHeader
        title={`Welcome back, ${me?.display_name.split(" ")[0] ?? ""}`}
        description="Deduplication activity across the datasets you can access."
        actions={
          <>
            {can(Perm.UPLOAD_CREATE) && <ButtonLink href="/uploads/new"><Upload className="h-4 w-4" />Upload dataset</ButtonLink>}
            {can(Perm.REVIEW_DECIDE) && <ButtonLink href="/review" variant="secondary"><ShieldCheck className="h-4 w-4" />Review queue</ButtonLink>}
          </>
        }
      />
      {overview.error ? <Card><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Card> : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Datasets" value={o ? formatNumber(o.datasets) : <Skeleton className="h-7 w-16" />}
            hint={o ? `${formatNumber(o.uploads.total)} uploads` : undefined} icon={<Database className="h-5 w-5" />} />
          <StatCard label="Records ingested" value={o ? formatNumber(o.records) : <Skeleton className="h-7 w-20" />}
            hint="Immutable source rows" icon={<FileStack className="h-5 w-5" />} tone="brand" />
          <StatCard label="Active master records" value={o ? formatNumber(o.active_masters) : <Skeleton className="h-7 w-20" />}
            hint="Golden records" icon={<GitMerge className="h-5 w-5" />} tone="green" />
          <StatCard label="Awaiting review" value={o ? formatNumber(pending) : <Skeleton className="h-7 w-12" />}
            hint={o ? `${formatNumber(resolved)} resolved` : undefined} icon={<ShieldCheck className="h-5 w-5" />} tone="amber" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Recent uploads" actions={can(Perm.UPLOAD_READ) && <Link href="/uploads" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>} />
          {!can(Perm.UPLOAD_READ) ? <EmptyState title="Uploads are not available for your role" /> : uploads.error ? <ErrorState error={uploads.error} onRetry={() => uploads.refetch()} /> : (
            <ul className="divide-y divide-slate-100">
              {uploads.isLoading && Array.from({ length: 4 }, (_, i) => <li key={i} className="px-5 py-3"><Skeleton className="h-4 w-2/3" /></li>)}
              {uploads.data?.items.length === 0 && <EmptyState title="No uploads yet" description="Uploaded CSV/XLSX files will appear here." />}
              {uploads.data?.items.map((u) => (
                <li key={u.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/uploads/${u.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{u.original_filename}</Link>
                    <p className="text-xs text-slate-500"><DatasetName id={u.dataset_id} link={false} /> · {formatNumber(u.row_count)} rows · {relativeTime(u.created_at)}</p>
                  </div>
                  <StatusBadge status={u.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Review queue" description="Open duplicate groups by confidence"
            actions={can(Perm.GROUP_READ) && <Link href="/analysis" className="text-sm font-medium text-brand-600 hover:text-brand-700">Analysis</Link>} />
          <CardBody className="space-y-4">
            {!o ? <Skeleton className="h-24 w-full" /> : pending === 0 ? (
              <EmptyState className="py-6" title="Queue is clear" description="No duplicate groups are waiting for review." />
            ) : pendingByTier.map(({ tier, n }) => (
              <div key={tier}>
                <div className="mb-1 flex justify-between text-sm">
                  <Link href={`/review?tier=${tier}`} className="font-medium text-slate-700 hover:text-brand-700">{humanize(tier)} confidence</Link>
                  <span className="tabular-nums text-slate-500">{formatNumber(n)}</span>
                </div>
                <ProgressBar value={pending ? (n / pending) * 100 : 0} tone={TIER_TONE[tier]} label={`${tier} confidence share`} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {can(Perm.JOB_READ) && (
        <Card className="mt-6">
          <CardHeader title="Background jobs" description="Ingestion and export processing" />
          {jobs.error ? <ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /> : (
            <ul className="divide-y divide-slate-100">
              {jobs.isLoading && <li className="px-5 py-3"><Skeleton className="h-4 w-1/2" /></li>}
              {jobs.data?.items.length === 0 && <EmptyState className="py-8" title="No jobs yet" />}
              {jobs.data?.items.map((j) => (
                <li key={j.id} className="grid grid-cols-1 items-center gap-2 px-5 py-3 sm:grid-cols-[1fr_12rem_7rem]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {humanize(j.job_type)} <span className="font-mono text-xs text-slate-400">#{j.id}</span>
                      {j.upload_id && <Link href={`/uploads/${j.upload_id}`} className="ml-2 text-xs font-normal text-brand-600 hover:underline">upload #{j.upload_id}</Link>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{j.error_summary ?? `${humanize(j.stage ?? j.status)} · ${relativeTime(j.created_at)}`}</p>
                  </div>
                  <ProgressBar value={j.progress_pct} tone={j.status === "failed" ? "red" : j.status === "succeeded" ? "green" : "brand"} label={`Job ${j.id} progress`} />
                  <div className="sm:text-right"><StatusBadge status={j.status} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}
