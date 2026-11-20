"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, Play, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Select } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DatasetName, UserName } from "@/components/ui/entities";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, ErrorState, InlineError, LoadingBlock } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { RecordsTable } from "@/features/search/RecordsTable";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { downloadUrl } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hasDatasetLevel, Perm } from "@/lib/permissions";
import { cn, formatBytes, formatDateTime, formatNumber, humanize } from "@/lib/utils";
import type { Job, UploadDetail, UploadStatus } from "@/types/api";

const FIELDS = [
  ["", "— Ignore column —"], ["first_name", "First name"], ["last_name", "Last name"], ["full_name", "Full name"],
  ["email", "Email"], ["linkedin_url", "LinkedIn URL"],
] as const;
const ACTIVE_JOB = new Set(["queued", "running", "retrying"]);

function Stepper({ status }: { status: UploadStatus }) {
  const steps = ["Uploaded", "Mapped", "Processing", "Completed"];
  const idx = { uploaded: 0, mapped: 1, processing: 2, completed: 3, failed: 2, cancelled: 2 }[status];
  const bad = status === "failed" || status === "cancelled";
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-label="Processing steps">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && status === "completed");
        const current = i === idx && !done;
        return (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
              done ? "border-emerald-500 bg-emerald-500 text-white"
                : current ? (bad ? "border-red-500 bg-red-50 text-red-600" : "border-brand-500 bg-brand-50 text-brand-700")
                  : "border-slate-300 text-slate-400")}>
              {done ? <Check className="h-3.5 w-3.5" /> : current && bad ? <XCircle className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn(done || current ? "text-slate-800" : "text-slate-400")}>{current && bad ? humanize(status) : s}</span>
            {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

function MappingCard({ upload }: { upload: UploadDetail }) {
  const qc = useQueryClient();
  const toast = useToast();
  const mapping = useQuery({ queryKey: ["mapping", upload.id], queryFn: () => endpoints.columnMapping(upload.id) });
  const preview = useQuery({ queryKey: ["preview", upload.id], queryFn: () => endpoints.preview(upload.id, 8) });
  const [edits, setEdits] = useState<Record<string, string> | null>(null);
  const initial = useMemo(() => {
    const m = mapping.data;
    return m ? { ...(m.column_mapping ?? m.suggested_mapping) } : {};
  }, [mapping.data]);
  const current = edits ?? initial;

  const save = useMutation({
    mutationFn: async (andProcess: boolean) => {
      const clean = Object.fromEntries(Object.entries(current).filter(([, v]) => v));
      await endpoints.setColumnMapping(upload.id, clean);
      if (andProcess) await endpoints.processUpload(upload.id);
      return andProcess;
    },
    onSuccess: (andProcess) => {
      toast.success(andProcess ? "Processing started" : "Mapping saved");
      setEdits(null);
      qc.invalidateQueries({ queryKey: ["upload", upload.id] });
      qc.invalidateQueries({ queryKey: ["mapping", upload.id] });
      qc.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  if (mapping.isLoading) return <Card><LoadingBlock label="Reading file headers…" /></Card>;
  if (mapping.error) return <Card><ErrorState error={mapping.error} onRetry={() => mapping.refetch()} /></Card>;
  const headers = mapping.data?.headers ?? [];
  const used = Object.values(current).filter(Boolean);
  const dupField = used.find((f, i) => used.indexOf(f) !== i);
  const sheet = preview.data?.sheets[0];

  return (
    <Card>
      <CardHeader title="Column mapping" description="Tell Opscore which source columns hold identity fields. Unmapped columns are still preserved in the raw record." />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {headers.map((h) => (
            <div key={h} className="rounded-md border border-slate-200 p-3">
              <label htmlFor={`map-${h}`} className="mb-1.5 block truncate text-xs font-semibold text-slate-700" title={h}>{h}</label>
              <Select id={`map-${h}`} value={current[h] ?? ""} data-testid={`map-${h}`}
                onChange={(e) => setEdits({ ...current, [h]: e.target.value })}>
                {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              {mapping.data?.suggested_mapping[h] && !mapping.data.column_mapping && (
                <p className="mt-1 text-[11px] text-slate-400">Suggested automatically</p>
              )}
            </div>
          ))}
        </div>
        {dupField && <InlineError error={new Error(`"${humanize(dupField)}" is mapped to more than one column.`)} />}
        <InlineError error={save.error} />
        {sheet && sheet.rows.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Preview · first {sheet.rows.length} rows{sheet.sheet_name ? ` of "${sheet.sheet_name}"` : ""}</p>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-500">Row</th>
                    {sheet.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">
                        {h}{current[h] && <Badge tone="indigo" className="ml-1.5">{humanize(current[h])}</Badge>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sheet.rows.map((r) => (
                    <tr key={r.row_number}>
                      <td className="px-3 py-1.5 tabular-nums text-slate-400">{r.row_number}</td>
                      {sheet.headers.map((h) => <td key={h} className="max-w-[14rem] truncate px-3 py-1.5 text-slate-700">{r.values[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => save.mutate(false)} loading={save.isPending && save.variables === false} disabled={!!dupField || save.isPending}>Save mapping</Button>
          <Button onClick={() => save.mutate(true)} loading={save.isPending && save.variables === true} disabled={!!dupField || save.isPending || used.length === 0}>
            <Play className="h-4 w-4" /> Save & start processing
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function JobCard({ job, canRetry }: { job: Job; canRetry: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const retry = useMutation({
    mutationFn: () => endpoints.retryJob(job.id),
    onSuccess: () => { toast.success("Job re-queued"); qc.invalidateQueries({ queryKey: ["upload"] }); },
    onError: (e) => toast.error("Retry failed", (e as Error).message),
  });
  const stats = Object.entries(job.stats ?? {}).filter(([, v]) => typeof v === "number" || typeof v === "string");
  return (
    <div className="rounded-md border border-slate-200 p-4" data-testid="job-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{humanize(job.job_type)} <span className="font-mono text-xs text-slate-400">job #{job.id}</span></p>
          <p className="text-xs text-slate-500">Stage: {humanize(job.stage ?? job.status)} · attempt {job.attempts}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {job.status === "failed" && canRetry && (
            <Button size="sm" variant="secondary" onClick={() => retry.mutate()} loading={retry.isPending}><RotateCcw className="h-3.5 w-3.5" />Retry</Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar className="flex-1" value={job.progress_pct} label="Job progress"
          tone={job.status === "failed" ? "red" : job.status === "succeeded" ? "green" : "brand"} />
        <span className="w-10 text-right text-xs tabular-nums text-slate-600">{job.progress_pct}%</span>
      </div>
      {job.error_summary && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{job.error_summary}</p>}
      {stats.length > 0 && (
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {stats.map(([k, v]) => <div key={k}><dt className="inline text-slate-500">{humanize(k)}: </dt><dd className="inline font-medium tabular-nums text-slate-800">{typeof v === "number" ? formatNumber(v) : String(v)}</dd></div>)}
        </dl>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Started {formatDateTime(job.started_at)} · finished {formatDateTime(job.finished_at)}</p>
    </div>
  );
}

export function UploadDetailView({ id }: { id: number }) {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<"overview" | "records">("overview");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const detail = useQuery({
    queryKey: ["upload", id], queryFn: () => endpoints.uploadDetail(id),
    refetchInterval: (q) => {
      const d = q.state.data;
      return d && (d.status === "processing" || d.jobs.some((j) => ACTIVE_JOB.has(j.status))) ? 1500 : false;
    },
  });
  const records = usePagedQuery("upload-records", (q) => endpoints.uploadRecords(id, q), { upload: id }, { enabled: tab === "records" });
  const cancel = useMutation({
    mutationFn: () => endpoints.cancelUpload(id),
    onSuccess: () => {
      setConfirmCancel(false);
      toast.success("Upload cancelled", "Rows already ingested are preserved.");
      qc.invalidateQueries({ queryKey: ["upload", id] });
      qc.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.error || !detail.data) return <Card><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></Card>;
  const u = detail.data;
  const canProcess = can(Perm.UPLOAD_PROCESS) && hasDatasetLevel(me, u.dataset_id, "upload");
  const groupTotal = Object.values(u.groups_by_status).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/uploads", label: "Uploads" }, { href: `/uploads/${u.id}`, label: `#${u.id}` }]}
        title={<span className="flex flex-wrap items-center gap-3">{u.original_filename} <StatusBadge status={u.status} /></span>}
        description={<>Dataset <DatasetName id={u.dataset_id} /> · uploaded by <UserName id={u.uploaded_by} /> · {formatDateTime(u.created_at)}</>}
        actions={
          <>
            <a href={downloadUrl(`/uploads/${u.id}/original`)} className={buttonClass("secondary")} download>
              <Download className="h-4 w-4" /> Original file
            </a>
            {canProcess && !["completed", "cancelled"].includes(u.status) && (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}><XCircle className="h-4 w-4" />Cancel</Button>
            )}
          </>
        }
      />
      <Card className="mb-6"><CardBody><Stepper status={u.status} /></CardBody></Card>

      <Tabs className="mb-6" value={tab} onChange={setTab}
        tabs={[{ value: "overview", label: "Overview" }, { value: "records", label: `Records (${formatNumber(u.record_count)})` }]} />

      {tab === "overview" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            {(u.status === "uploaded" || u.status === "mapped") && (canProcess ? <MappingCard upload={u} /> : (
              <Card><EmptyState title="Waiting for column mapping" description="A data manager with upload access to this dataset must confirm the mapping and start processing." /></Card>
            ))}
            <Card>
              <CardHeader title="Processing" description="Live status of background jobs for this upload" />
              <CardBody className="space-y-3">
                {u.jobs.length === 0 ? <p className="text-sm text-slate-500">No processing jobs yet.</p>
                  : u.jobs.map((j) => <JobCard key={j.id} job={j} canRetry={canProcess} />)}
              </CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="File details" />
              <CardBody>
                <KeyValues className="sm:grid-cols-1" items={[
                  ["Rows parsed", formatNumber(u.row_count)],
                  ["Row errors", <span key="e" className={u.error_count ? "text-red-600" : ""}>{formatNumber(u.error_count)}</span>],
                  ["Records stored", formatNumber(u.record_count)],
                  ["Size / format", `${formatBytes(u.size_bytes)} · ${u.file_format.toUpperCase()}`],
                  ["SHA-256", <span key="s" className="break-all font-mono text-[11px]">{u.sha256}</span>],
                  ["Storage", u.storage_backend],
                  ["Processed", formatDateTime(u.processed_at)],
                  ["Notes", u.notes || "—"],
                ]} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Duplicate groups" description="Raised from this upload" />
              <CardBody>
                {groupTotal === 0 ? <p className="text-sm text-slate-500">No duplicate groups raised from this upload.</p> : (
                  <ul className="space-y-2">
                    {Object.entries(u.groups_by_status).map(([s, n]) => (
                      <li key={s} className="flex items-center justify-between">
                        <StatusBadge status={s} />
                        <Link href={`/review?upload_id=${u.id}&status=${s}`} className="text-sm font-medium tabular-nums text-brand-700 hover:underline">{formatNumber(n)}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            {u.column_mapping && (
              <Card>
                <CardHeader title="Confirmed mapping" />
                <CardBody>
                  <ul className="space-y-1.5 text-sm">
                    {Object.entries(u.column_mapping).map(([col, f]) => (
                      <li key={col} className="flex justify-between gap-3"><span className="truncate text-slate-600">{col}</span><Badge tone="indigo">{humanize(f)}</Badge></li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <RecordsTable rows={records.items} isLoading={records.isLoading} isFetching={records.isFetching} error={records.error}
            onRetry={() => records.refetch()} pager={records.pager} nextCursor={records.nextCursor}
            empty={<EmptyState title="No records yet" description="Records appear once processing has ingested rows." />} />
        </Card>
      )}

      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => cancel.mutate()}
        loading={cancel.isPending} error={cancel.error} tone="danger" confirmLabel="Cancel upload"
        title="Cancel this upload?"
        description="Further processing stops. Rows already ingested and the original file are preserved; this cannot be resumed." />
    </>
  );
}
