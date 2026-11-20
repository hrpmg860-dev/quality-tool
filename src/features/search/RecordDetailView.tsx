"use client";

import { useQuery } from "@tanstack/react-query";
import { Fingerprint } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { DataTable } from "@/components/tables/DataTable";
import { DatasetName, IdLink, UserName } from "@/components/ui/entities";
import { ConfidenceScore } from "@/components/ui/progress";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { endpoints } from "@/lib/api/endpoints";
import { cn, formatDateTime, humanize, recordDisplayName } from "@/lib/utils";

export function RecordDetailView({ id }: { id: number }) {
  const detail = useQuery({ queryKey: ["record", id], queryFn: () => endpoints.record(id) });
  const matches = useQuery({ queryKey: ["record-matches", id], queryFn: () => endpoints.recordMatches(id), enabled: !!detail.data });
  const [tab, setTab] = useState<"identity" | "raw" | "links" | "matches">("identity");

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.error || !detail.data) return <Card><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></Card>;
  const r = detail.data;

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/search", label: "Record search" }, { href: `/records/${r.id}`, label: `#${r.id}` }]}
        title={<span className="flex items-center gap-3"><Fingerprint className="h-6 w-6 text-brand-600" />{recordDisplayName(r)}{r.redacted && <Badge tone="gray">restricted</Badge>}</span>}
        description={r.redacted
          ? "This record belongs to a dataset you cannot read — only identifiers are visible."
          : <>Immutable source row from <Link href={`/uploads/${r.upload_id}`} className="font-medium text-brand-700 hover:underline">{r.source_filename}</Link> · <DatasetName id={r.dataset_id} /></>}
        actions={r.current_master_id != null && (
          <Link href={`/masters/${r.current_master_id}`} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Master M-{r.current_master_id}
          </Link>
        )}
      />

      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: "identity", label: "Identity" },
        { value: "raw", label: "Raw row", hidden: r.redacted },
        { value: "links", label: `Link history (${r.link_history.length})` },
        { value: "matches", label: `Match evidence (${matches.data?.length ?? 0})` },
      ]} />

      {tab === "identity" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Normalized values" description="What the matcher compares (quality flags below)" />
            <CardBody>
              {r.normalized ? (
                <KeyValues className="sm:grid-cols-1" items={[
                  ["Full name", r.normalized.full_name_norm],
                  ["First / last", [r.normalized.first_name_norm, r.normalized.last_name_norm].filter(Boolean).join(" / ") || "—"],
                  ["Email", r.normalized.email_norm],
                  ["Email domain", r.normalized.email_domain],
                  ["LinkedIn slug", r.normalized.linkedin_slug],
                  ["Normalization version", r.normalized.normalization_version],
                ]} />
              ) : <p className="text-sm text-slate-500">Not normalized.</p>}
              {r.normalized && Object.keys(r.normalized.quality_flags ?? {}).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {Object.entries(r.normalized.quality_flags).map(([k, v]) => <Badge key={k} tone="amber">{humanize(k)}: {String(v)}</Badge>)}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Lineage" />
            <CardBody>
              <KeyValues className="sm:grid-cols-1" items={[
                ["Record ID", <span key="i" className="font-mono">{r.id}</span>],
                ["Dataset", <DatasetName key="d" id={r.dataset_id} />],
                ["Upload", r.upload_id ? <Link key="u" href={`/uploads/${r.upload_id}`} className="text-brand-700 hover:underline">{r.source_filename} (#{r.upload_id})</Link> : "—"],
                ["Sheet / row", [r.sheet_name, r.row_number != null ? `row ${r.row_number}` : null].filter(Boolean).join(" · ") || "—"],
                ["Uploaded by", <UserName key="u2" id={r.uploaded_by} />],
                ["Ingested", formatDateTime(r.ingested_at)],
                ["Row hash", <span key="h" className="break-all font-mono text-[11px]">{r.raw_row_hash}</span>],
              ]} />
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "raw" && (
        <Card>
          <CardHeader title="Raw row" description="Verbatim source values — never modified" />
          <CardBody>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(r.raw_data ?? {}).map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row" className="w-64 bg-slate-50 px-3 py-2 text-left align-top text-xs font-medium text-slate-500">{k}</th>
                      <td className={cn("px-3 py-2 text-slate-800", /^=\s*\(?[A-Z]+\d+/.test(v) && "bg-amber-50 font-mono text-xs text-amber-800")}>
                        {v || <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  ))}
                  {Object.keys(r.raw_data ?? {}).length === 0 && <tr><td className="px-3 py-6 text-center text-sm text-slate-400">Empty row.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "links" && (
        <Card>
          <DataTable caption="Link windows" rowKey={(l) => l.id} rows={r.link_history} isLoading={false}
            columns={[
              { key: "master", header: "Master", cell: (l) => <IdLink href={`/masters/${l.master_record_id}`} id={l.master_record_id} prefix="M-" /> },
              { key: "from", header: "Valid from", className: "whitespace-nowrap", cell: (l) => formatDateTime(l.valid_from) },
              { key: "to", header: "Valid to", className: "whitespace-nowrap", cell: (l) => (l.valid_to ? formatDateTime(l.valid_to) : <Badge tone="green">current</Badge>) },
              { key: "opened", header: "Opened by event", cell: (l) => l.created_by_event_id ?? <span className="text-slate-400">system</span> },
              { key: "closed", header: "Closed by event", cell: (l) => l.ended_by_event_id ?? "—" },
            ]}
            empty={<EmptyState title="No link history" />} />
        </Card>
      )}

      {tab === "matches" && (
        <Card>
          {matches.isLoading ? <LoadingBlock /> : matches.error ? <ErrorState error={matches.error} onRetry={() => matches.refetch()} /> : (
            <DataTable caption="Match evidence" rowKey={(m) => m.id} rows={matches.data} isLoading={false}
              columns={[
                { key: "match", header: "Match", cell: (m) => <span className="font-mono text-xs">#{m.id}</span> },
                { key: "group", header: "Group", cell: (m) => <Link href={`/review/${m.group_id}`} className="font-mono text-xs text-brand-700 hover:underline">group #{m.group_id}</Link> },
                { key: "other", header: "Other record", cell: (m) => <IdLink href={`/records/${m.record_a_id === r.id ? m.record_b_id : m.record_a_id}`} id={m.record_a_id === r.id ? m.record_b_id : m.record_a_id} /> },
                { key: "score", header: "Confidence", cell: (m) => <ConfidenceScore score={m.score} /> },
                { key: "tier", header: "Tier", cell: (m) => <StatusBadge status={m.tier} /> },
                { key: "status", header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
                { key: "created", header: "Created", className: "whitespace-nowrap", cell: (m) => formatDateTime(m.created_at) },
              ]}
              empty={<EmptyState title="No matches" description="No matcher evidence references this record." />} />
          )}
        </Card>
      )}
    </>
  );
}
