"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, ShieldBan, UploadCloud, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type DragEvent, useRef, useState } from "react";
import { Field, Select, Textarea } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useDatasets } from "@/components/ui/entities";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, InlineError, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ApiError, type UploadHandle } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { datasetsWithLevel, Perm } from "@/lib/permissions";
import { cn, formatBytes } from "@/lib/utils";
import type { UploadCreated } from "@/types/api";

const ACCEPT = [".csv", ".xlsx", ".xls"];
const MAX_BYTES = 500 * 1024 * 1024;

export function validateFile(f: File): string | null {
  const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPT.includes(ext)) return "Only .csv, .xlsx and .xls files are supported.";
  if (f.size === 0) return "The file is empty.";
  if (f.size > MAX_BYTES) return `The file exceeds the ${formatBytes(MAX_BYTES)} limit.`;
  return null;
}

function UploadCard({ title, description, purpose, datasetId }: {
  title: string; description: string; purpose: "data" | "suppression"; datasetId: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = useRef<UploadHandle<UploadCreated> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [duplicateOf, setDuplicateOf] = useState<boolean>(false);

  const uploading = progress !== null;

  function pick(f: File | undefined | null) {
    if (!f) return;
    const problem = validateFile(f);
    setError(problem ? new Error(problem) : null);
    setFile(problem ? null : f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!uploading) pick(e.dataTransfer.files?.[0]);
  }

  async function start(allowDuplicate = false) {
    if (!file || !datasetId) return;
    setError(null);
    setDuplicateOf(false);
    setProgress({ loaded: 0, total: file.size });
    handle.current = endpoints.upload(Number(datasetId), file, notes.trim() || undefined,
      (loaded, total) => setProgress({ loaded, total }), allowDuplicate, purpose);
    try {
      const up = await handle.current.promise;
      qc.invalidateQueries({ queryKey: ["uploads"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast.success("File uploaded", "Original stored write-once. Next: confirm the column mapping.");
      router.push(`/uploads/${up.id}`);
    } catch (e) {
      setProgress(null);
      if (e instanceof ApiError && e.status === 409 && /already uploaded/i.test(e.message)) setDuplicateOf(true);
      else if (!(e instanceof ApiError && e.code === "aborted")) setError(e);
    } finally {
      handle.current = null;
    }
  }

  const pct = progress && progress.total ? (progress.loaded / progress.total) * 100 : 0;

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn("rounded-lg border-2 border-dashed p-8 text-center transition-colors",
            dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/50")}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3 text-left">
              <FileSpreadsheet className="h-9 w-9 text-emerald-600" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900" data-testid="selected-file">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
              </div>
              {!uploading && (
                <button aria-label="Remove file" onClick={() => setFile(null)} className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm text-slate-700">
                Drag and drop a file here, or{" "}
                <button className="font-medium text-brand-600 hover:text-brand-700" onClick={() => inputRef.current?.click()}>browse</button>
              </p>
              <p className="mt-1 text-xs text-slate-500">Each file is fingerprinted (SHA-256); identical re-uploads are flagged.</p>
            </>
          )}
          <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="sr-only" aria-label={`Choose ${purpose} file`}
            data-testid={`file-input-${purpose}`} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        <Field label="Notes" hint="Optional context for reviewers (source system, campaign, etc.)">
          {(id) => <Textarea id={id} rows={2} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={uploading} />}
        </Field>

        {progress && (
          <div className="space-y-1.5" data-testid="upload-progress">
            <div className="flex justify-between text-xs text-slate-600">
              <span>{pct >= 100 ? "Finalizing — storing and fingerprinting…" : "Uploading…"}</span>
              <span className="tabular-nums">{formatBytes(progress.loaded)} / {formatBytes(progress.total)} · {Math.floor(pct)}%</span>
            </div>
            <ProgressBar value={pct} label="Upload progress" />
          </div>
        )}
        <InlineError error={error} />

        <div className="flex justify-end gap-2">
          {uploading && <Button variant="secondary" onClick={() => handle.current?.abort()}>Cancel upload</Button>}
          <Button onClick={() => start(false)} disabled={!file || !datasetId} loading={uploading}>
            <UploadCloud className="h-4 w-4" /> Upload {purpose === "suppression" ? "suppression" : "file"}
          </Button>
        </div>
      </CardBody>

      <ConfirmDialog
        open={duplicateOf}
        onClose={() => setDuplicateOf(false)}
        onConfirm={() => start(true)}
        title="This exact file was already uploaded"
        description="A byte-identical file exists in this dataset. Uploading it again creates a separate upload and may produce duplicate records."
        confirmLabel="Upload anyway"
      />
    </Card>
  );
}

export function UploadView() {
  const { me, can } = useAuth();
  const params = useSearchParams();
  const datasets = useDatasets();
  const [datasetId, setDatasetId] = useState<string>(params.get("dataset") ?? "");

  const uploadable = datasetsWithLevel(me, datasets.data ?? [], "upload").filter((d) => d.status === "active");
  const selectedId = datasetId || (uploadable.length === 1 ? String(uploadable[0].id) : "");

  return (
    <RequirePerm allowed={can(Perm.UPLOAD_CREATE)}>
      <PageHeader title="Upload dataset" description="Add a CSV or Excel file. The original is preserved unchanged; you'll map columns before processing."
        breadcrumb={[{ href: "/uploads", label: "Uploads" }, { href: "/uploads/new", label: "New upload" }]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {datasets.isLoading ? <Card><CardBody><LoadingBlock /></CardBody></Card> : uploadable.length === 0 ? (
            <Card><CardBody><EmptyState title="No dataset accepts uploads from you" description="You need 'upload' access on an active dataset. Ask a dataset manager or administrator." /></CardBody></Card>
          ) : (
            <>
              <Card>
                <CardBody>
                  <Field label="Target dataset" required hint="Both sections below upload into this dataset">
                    {(id) => (
                      <Select id={id} value={selectedId} onChange={(e) => setDatasetId(e.target.value)}>
                        <option value="">Select a dataset…</option>
                        {uploadable.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </Select>
                    )}
                  </Field>
                </CardBody>
              </Card>

              <UploadCard
                title="Lead data file"
                description="New leads to deduplicate. Rows are checked against every record and golden master in this dataset."
                purpose="data"
                datasetId={selectedId}
              />
              <UploadCard
                title="Suppression list"
                description="Known/do-not-contact leads. Rows join the match pool — later uploads that hit them surface as duplicate proposals."
                purpose="suppression"
                datasetId={selectedId}
              />
            </>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader title="What happens next" />
          <CardBody>
            <ol className="space-y-4 text-sm">
              {[
                ["Store original", "Bytes are written once to company storage and never modified."],
                ["Map columns", "Confirm which columns hold name, email and LinkedIn."],
                ["Process", "Rows are parsed and normalized in the background with live progress."],
                ["Review", "Potential duplicates go to the review queue — nothing merges without approval."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                  <div><p className="font-medium text-slate-900">{t}</p><p className="text-slate-500">{d}</p></div>
                </li>
              ))}
              <li className="flex gap-3 border-t border-slate-100 pt-4">
                <ShieldBan className="h-5 w-5 shrink-0 text-amber-600" />
                <div><p className="font-medium text-slate-900">Suppression</p>
                  <p className="text-slate-500">Suppression rows deduplicate like normal leads — a new lead matching one is proposed as its duplicate.</p></div>
              </li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </RequirePerm>
  );
}
