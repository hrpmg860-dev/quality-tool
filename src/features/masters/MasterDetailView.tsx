"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { GitMerge, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Textarea } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { IdLink, UserName } from "@/components/ui/entities";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { recordColumns } from "@/features/search/RecordsTable";
import { DataTable } from "@/components/tables/DataTable";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { formatDateTime, humanize, masterName } from "@/lib/utils";

export function MasterDetailView({ id }: { id: number }) {
  const { can } = useAuth();
  const toast = useToast();
  const detail = useQuery({ queryKey: ["master", id], queryFn: () => endpoints.master(id) });
  const [tab, setTab] = useState<"sources" | "former" | "links" | "history">("sources");
  const [revertId, setRevertId] = useState<number | null>(null);
  const [revertComment, setRevertComment] = useState("");
  const revert = useMutation({
    mutationFn: (eventId: number) => endpoints.reverseMergeEvent(eventId, revertComment.trim() || undefined),
    onSuccess: () => {
      setRevertId(null);
      setRevertComment("");
      toast.success("Merge reversed", "A compensating unmerge event restored the previous masters and links.");
      detail.refetch();
    },
  });

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.error || !detail.data) return <Card><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></Card>;
  const m = detail.data;

  const reversedIds = new Set(m.history.map((e) => e.reverses_event_id).filter((x): x is number => x != null));
  // Newest-first per surviving master: only the latest unreverted
  // attach/merge for each master_record_id is offered for reversal.
  const newestReversible = new Map<number, number>();
  for (const e of m.history) {
    if ((e.event_type === "attach" || e.event_type === "merge") && !reversedIds.has(e.id) && e.master_record_id != null) {
      newestReversible.set(e.master_record_id, e.id);
    }
  }
  const canRevert = can(Perm.MERGE_REVERT);

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/masters", label: "Master records" }, { href: `/masters/${m.id}`, label: `M-${m.id}` }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <GitMerge className="h-6 w-6 text-brand-600" />
            {masterName(m)}
            <StatusBadge status={m.status} />
          </span>
        }
        description={m.merged_into_id ? <>Merged into <Link href={`/masters/${m.merged_into_id}`} className="font-medium text-brand-700 hover:underline">M-{m.merged_into_id}</Link> — retained for lineage.</> : "Golden record and its merge lineage."}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Golden values" description="Canonical survivor values" />
          <CardBody>
            <KeyValues className="sm:grid-cols-1" items={[
              ["Full name", m.golden_full_name],
              ["First / last", [m.golden_first_name, m.golden_last_name].filter(Boolean).join(" / ") || "—"],
              ["Primary email", m.primary_email],
              ["LinkedIn", m.linkedin_url],
              ["Version", `v${m.version}`],
              ["Created", formatDateTime(m.created_at)],
              ["Updated", formatDateTime(m.updated_at)],
            ]} />
          </CardBody>
        </Card>

        <div className="xl:col-span-2">
          <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
            { value: "sources", label: `Source records (${m.source_records.length})` },
            { value: "former", label: `Former records (${m.former_records.length})` },
            { value: "links", label: `Link windows (${m.links.length})` },
            { value: "history", label: `Merge history (${m.history.length})` },
          ]} />
          <Card>
            {(tab === "sources" || tab === "former") && (
              <DataTable caption="Records" columns={recordColumns({ showDataset: true })} rowKey={(r) => r.id}
                rows={tab === "sources" ? m.source_records : m.former_records} isLoading={false}
                empty={<EmptyState title={tab === "sources" ? "No active source records" : "No former records"} />} />
            )}
            {tab === "links" && (
              <DataTable
                caption="Link windows"
                rowKey={(l) => l.id}
                rows={m.links}
                isLoading={false}
                columns={[
                  { key: "record", header: "Record", cell: (l) => <IdLink href={`/records/${l.record_id}`} id={l.record_id} /> },
                  { key: "from", header: "Valid from", className: "whitespace-nowrap", cell: (l) => formatDateTime(l.valid_from) },
                  {
                    key: "to", header: "Valid to", className: "whitespace-nowrap", cell: (l) => (l.valid_to ? formatDateTime(l.valid_to) : <Badge tone="green">current</Badge>),
                  },
                  { key: "opened", header: "Opened by event", cell: (l) => l.created_by_event_id ?? <span className="text-slate-400">system</span> },
                  { key: "closed", header: "Closed by event", cell: (l) => l.ended_by_event_id ?? "—" },
                ]}
                empty={<EmptyState title="No link windows" />}
              />
            )}
            {tab === "history" && (
              <DataTable
                caption="Merge history"
                rowKey={(e) => e.id}
                rows={m.history}
                isLoading={false}
                columns={[
                  {
                    key: "event", header: "Event", cell: (e) => (
                      <span className="flex items-center gap-1.5">
                        <StatusBadge status={e.event_type} />
                        {reversedIds.has(e.id) && <Badge tone="gray">reversed</Badge>}
                        {e.reverses_event_id != null && <span className="text-[11px] text-slate-400">of #{e.reverses_event_id}</span>}
                      </span>
                    ),
                  },
                  { key: "actor", header: "Actor", cell: (e) => <UserName id={e.actor_id} /> },
                  { key: "master", header: "Master", cell: (e) => e.master_record_id ?? "—" },
                  { key: "source", header: "Source master", cell: (e) => e.target_master_id ?? "—" },
                  { key: "decision", header: "Decision", cell: (e) => e.review_decision_id ?? <Badge tone="gray">system</Badge> },
                  {
                    key: "when", header: "When", className: "whitespace-nowrap",
                    cell: (e) => <span title={formatDateTime(e.created_at)}>{formatDateTime(e.created_at)}</span>,
                  },
                  {
                    key: "actions", header: "", className: "text-right",
                    cell: (e) => {
                      if (!canRevert || (e.event_type !== "attach" && e.event_type !== "merge") || reversedIds.has(e.id)) return null;
                      const blocked = e.master_record_id != null && newestReversible.get(e.master_record_id) !== e.id;
                      return (
                        <Button variant="ghost" size="sm" disabled={blocked}
                          title={blocked ? "Reverse newer merges into this master first" : "Reverse this merge (unmerge)"}
                          onClick={() => { setRevertId(e.id); setRevertComment(""); }}>
                          <Undo2 className="h-3.5 w-3.5" /> Revert
                        </Button>
                      );
                    },
                  },
                ]}
                empty={<EmptyState title="No merge events" description="This master was created at ingest and never merged." />}
              />
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={revertId != null}
        onClose={() => setRevertId(null)}
        onConfirm={() => revertId != null && revert.mutate(revertId)}
        loading={revert.isPending}
        error={revert.error}
        tone="danger"
        confirmLabel="Reverse merge"
        title={`Reverse merge event #${revertId}?`}
        description="A compensating unmerge event is appended to the merge log: the moved records are re-linked to their previous master and the retired master is re-activated. Nothing is deleted; the reversal is itself fully audited."
      >
        <div>
          <label htmlFor="revert-comment" className="mb-1 block text-xs font-medium text-slate-700">Comment</label>
          <Textarea id="revert-comment" rows={3} maxLength={5000} value={revertComment}
            onChange={(e) => setRevertComment(e.target.value)} placeholder="Why is this merge being reversed?" />
        </div>
      </ConfirmDialog>
    </>
  );
}
