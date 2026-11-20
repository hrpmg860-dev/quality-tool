"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Eye, Hand, History, ShieldCheck, Split, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Textarea } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DatasetName, IdLink, UserName } from "@/components/ui/entities";
import { ConfidenceScore } from "@/components/ui/progress";
import { ErrorState, InlineError, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hasDatasetLevel, Perm } from "@/lib/permissions";
import { cn, formatDateTime, formatNumber, humanize, masterName, recordDisplayName, scoreValue } from "@/lib/utils";
import type { DecisionType, GroupDetail, Master, Match, RecordItem } from "@/types/api";
import { buildComparison, describeEvidence, groupConfidence, orderRecords } from "./compare";

/** Side-by-side grid of every member record. Anchor first; agreeing cells
 * green, conflicting cells red-tinted. */
function ComparisonTable({ group }: { group: GroupDetail }) {
  const records = useMemo(
    () => orderRecords(group.records, group.matches, group.anchor_record_id),
    [group],
  );
  const rows = useMemo(() => buildComparison(records), [records]);
  const pendingPairs = useMemo(() => {
    const m = new Map<string, Match>();
    for (const mt of group.matches.filter((x) => x.status === "pending")) {
      m.set(`${mt.record_a_id}:${mt.record_b_id}`, mt);
    }
    return m;
  }, [group.matches]);

  if (records.length === 0) return <p className="text-sm text-slate-500">No member records.</p>;

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th scope="col" className="sticky left-0 z-10 w-44 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Field</th>
            {records.map((r, i) => (
              <th key={r.id} scope="col" className="min-w-[15rem] px-3 py-2.5 text-left">
                <Link href={`/records/${r.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700" data-testid="compare-record">
                  {recordDisplayName(r)}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-normal text-slate-500">
                  <span className="font-mono">#{r.id}</span>
                  {r.id === group.anchor_record_id && <Badge tone="indigo">anchor</Badge>}
                  {r.redacted && <Badge tone="gray">restricted</Badge>}
                  {i > 0 && pendingPairs.get(`${Math.min(group.anchor_record_id ?? 0, r.id)}:${Math.max(group.anchor_record_id ?? 0, r.id)}`) && (
                    <ConfidenceScore compact score={pendingPairs.get(`${Math.min(group.anchor_record_id ?? 0, r.id)}:${Math.max(group.anchor_record_id ?? 0, r.id)}`)!.score} />
                  )}
                </p>
                {!r.redacted && r.current_master_id != null && (
                  <p className="mt-0.5 text-[11px] font-normal text-slate-400">
                    master <Link className="text-brand-600 hover:underline" href={`/masters/${r.current_master_id}`}>M-{r.current_master_id}</Link>
                  </p>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key} className={cn(row.section === "raw" && "bg-slate-50/40")}>
              <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left align-top text-xs font-medium text-slate-500">
                {row.label}
                {row.section === "normalized" && <span className="ml-1 text-[10px] text-slate-300">norm</span>}
              </th>
              {row.values.map((v, i) => (
                <td key={records[i].id} className={cn("max-w-[22rem] break-words px-3 py-2 align-top text-[13px]",
                  row.conflict && "bg-red-50/60 text-red-900",
                  row.agree && "bg-emerald-50/50 text-emerald-900")}>
                  {v ?? <span className="text-slate-300">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EvidencePanel({ group }: { group: GroupDetail }) {
  return (
    <ul className="space-y-3">
      {group.matches.map((m) => (
        <li key={m.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/review/matches/${m.id}`} className="font-mono text-xs text-slate-500 hover:text-brand-700">
              match #{m.id} · {m.record_a_id} ↔ {m.record_b_id}
            </Link>
            <StatusBadge status={m.status} />
          </div>
          <div className="mt-2"><ConfidenceScore score={m.score} /></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {describeEvidence(m.evidence).map((e, i) => (
              <Badge key={i} tone={e.kind === "positive" ? "green" : e.kind === "negative" ? "red" : "gray"}>{e.label}</Badge>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">{humanize(m.tier)} tier · {humanize(m.scope)} scope</p>
        </li>
      ))}
    </ul>
  );
}

function HistoryPanel({ id }: { id: number }) {
  const history = useQuery({ queryKey: ["group-history", id], queryFn: () => endpoints.groupHistory(id) });
  if (history.isLoading) return <LoadingBlock />;
  if (history.error) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  const h = history.data;
  if (!h || (!h.decisions.length && !h.merge_events.length)) return <p className="text-sm text-slate-500">No decisions yet.</p>;
  return (
    <div className="space-y-4">
      {h.decisions.map((d) => (
        <div key={d.id} className="rounded-md border border-slate-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={d.decision} />
            <span className="text-xs text-slate-500">by <UserName id={d.reviewer_id} /> · {formatDateTime(d.created_at)}</span>
          </div>
          {d.comment && <p className="mt-1.5 text-sm text-slate-700">“{d.comment}”</p>}
        </div>
      ))}
      {h.merge_events.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Resulting merge events</p>
          <ul className="space-y-1 text-sm">
            {h.merge_events.map((e) => (
              <li key={e.id} className="text-slate-600">
                <Badge tone="violet">{humanize(e.event_type)}</Badge>{" "}
                master {e.target_master_id ?? "—"} → {e.master_record_id ?? "—"} · {formatDateTime(e.created_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const GOLDEN_FIELDS: [keyof Master, string][] = [
  ["golden_full_name", "Full name"],
  ["golden_first_name", "First name"],
  ["golden_last_name", "Last name"],
  ["primary_email", "Email"],
  ["linkedin_url", "LinkedIn"],
];

/** Target-master picker + per-field survivorship picks for approve/split. */
function MergeOptions({ group: g, target, onTarget, selections, onSelect, allowFieldPicks }: {
  group: GroupDetail; target: number | null; onTarget: (v: number | null) => void;
  selections: Record<string, number>; onSelect: (field: string, masterId: number | null) => void;
  allowFieldPicks: boolean;
}) {
  const masters = g.candidate_masters;
  const selectCls = "h-8 w-full rounded-md border border-slate-300 px-2 text-xs focus:border-brand-500 focus:outline-none";
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <div>
        <label htmlFor="target-master" className="mb-1 block text-xs font-medium text-slate-700">
          Consolidate into master{g.multi_master_conflict && <span className="text-red-500"> *</span>}
        </label>
        <select id="target-master" value={target ?? ""} onChange={(e) => onTarget(Number(e.target.value) || null)} className={selectCls}>
          <option value="">{g.multi_master_conflict ? "Choose target master…" : "Auto (proposed / anchor master)"}</option>
          {masters.map((m) => <option key={m.id} value={m.id}>M-{m.id} — {masterName(m)}</option>)}
        </select>
      </div>
      {!allowFieldPicks ? (
        <p className="text-[11px] leading-snug text-slate-500">
          Field-level survivorship and merging established masters require the <code>merge.execute</code> permission (Manager).
        </p>
      ) : (
      <div>
        <p className="text-xs font-medium text-slate-700">Field-level values <span className="font-normal text-slate-400">(optional)</span></p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Pick which master supplies each golden field. Unset fields keep the target&apos;s values, with gaps filled from merged-in masters.
        </p>
        <div className="mt-1.5 space-y-1.5">
          {GOLDEN_FIELDS.map(([f, label]) => (
            <div key={f} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
              <select aria-label={`Winning value for ${label}`} value={selections[f] ?? ""}
                onChange={(e) => onSelect(f, e.target.value ? Number(e.target.value) : null)} className={selectCls}>
                <option value="">Auto</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>M-{m.id}: {(m[f] as string | null) ?? "—"}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

const DECISIONS: { key: DecisionType; label: string; icon: typeof ThumbsUp; tone: "success" | "danger" | "primary" | "secondary"; help: string }[] = [
  { key: "approve", label: "Approve & merge", icon: ThumbsUp, tone: "success", help: "All pending matches are confirmed; records consolidate into the target master. Fully reversible." },
  { key: "reject", label: "Reject all", icon: ThumbsDown, tone: "danger", help: "Every pair is marked cannot-link — they will not be proposed again." },
  { key: "split", label: "Split decision", icon: Split, tone: "primary", help: "Approve some pairs, reject others." },
  { key: "defer", label: "Defer", icon: Clock, tone: "secondary", help: "Send back to the pending queue with a note." },
];

export function ReviewDetailView({ id }: { id: number }) {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [comment, setComment] = useState("");
  const [split, setSplit] = useState<Record<string, "approve" | "reject">>({});
  const [target, setTarget] = useState<number | null>(null);
  const [fieldSel, setFieldSel] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"compare" | "evidence" | "history">("compare");

  const group = useQuery({ queryKey: ["group", id], queryFn: () => endpoints.group(id) });
  const g = group.data;
  const canDecide = can(Perm.REVIEW_DECIDE) && g != null && hasDatasetLevel(me, g.dataset_id, "review");
  const canApprove = can(Perm.REVIEW_APPROVE);
  const canMerge = can(Perm.MERGE_EXECUTE);
  const claimedByMe = g?.assigned_to === me?.id;
  const claimedByOther = g?.assigned_to != null && !claimedByMe;
  const open = g?.status === "pending" || g?.status === "in_review";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["group", id] });
    qc.invalidateQueries({ queryKey: ["group-history", id] });
    qc.invalidateQueries({ queryKey: ["groups"] });
    qc.invalidateQueries({ queryKey: ["group-stats"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
  };
  const claim = useMutation({ mutationFn: () => endpoints.claimGroup(id), onSuccess: refresh, onError: (e) => toast.error("Could not claim", (e as Error).message) });
  const release = useMutation({ mutationFn: () => endpoints.releaseGroup(id), onSuccess: refresh, onError: (e) => toast.error("Could not release", (e as Error).message) });
  const submit = useMutation({
    mutationFn: () => endpoints.decide(id, {
      decision: decision as DecisionType,
      group_version_seen: g!.version,
      member_decisions: decision === "split" ? split : undefined,
      target_master_id: target ?? undefined,
      field_selections: Object.keys(fieldSel).length ? fieldSel : undefined,
      comment: comment.trim() || undefined,
    }),
    onSuccess: (r) => {
      setDecision(null);
      setComment("");
      setSplit({});
      setTarget(null);
      setFieldSel({});
      toast.success(
        r.decision.decision === "defer" ? "Group deferred" : `Decision recorded — group ${r.group.status}`,
        r.merge_events.length ? `${r.merge_events.length} merge event(s) written (audit-logged).` : undefined,
      );
      refresh();
    },
  });

  if (group.isLoading) return <LoadingBlock label="Loading duplicate group…" />;
  if (group.error || !g) return <Card><ErrorState error={group.error} onRetry={() => group.refetch()} /></Card>;

  const pending = g.matches.filter((m) => m.status === "pending");
  const splitHasApprovals = Object.values(split).includes("approve");
  const mergeNeedsTarget = g.multi_master_conflict && !target;
  const setField = (f: string, mid: number | null) =>
    setFieldSel((s) => { const n = { ...s }; if (mid == null) delete n[f]; else n[f] = mid; return n; });
  const mergeOptions = (
    <MergeOptions group={g} target={target} onTarget={setTarget} selections={fieldSel} onSelect={setField}
      allowFieldPicks={canMerge} />
  );
  const versionConflict = submit.error && (submit.error as { status?: number }).status === 409;

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/review", label: "Review center" }, { href: `/review/${g.id}`, label: `Group #${g.id}` }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Duplicate group #{g.id}
            <StatusBadge status={g.status} />
            <Badge tone={({ high: "green", medium: "amber", low: "red" } as const)[g.confidence_tier]}>{humanize(g.confidence_tier)} confidence</Badge>
            {g.multi_master_conflict && <Badge tone="red">multi-master conflict</Badge>}
          </span>
        }
        description={<>{formatNumber(g.records.length)} records · {formatNumber(g.matches.length)} pair(s) · {humanize(g.scope)} scope · dataset <DatasetName id={g.dataset_id} /></>}
        actions={
          canDecide && open && (
            <>
              {!claimedByMe && <Button variant="secondary" onClick={() => claim.mutate()} loading={claim.isPending} disabled={claimedByOther}><Hand className="h-4 w-4" />{claimedByOther ? "Claimed" : "Claim"}</Button>}
              {claimedByMe && <Button variant="ghost" onClick={() => release.mutate()} loading={release.isPending}>Release</Button>}
            </>
          )
        }
      />

      {claimedByOther && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <Eye className="h-4 w-4 shrink-0" /> Claimed by <UserName id={g.assigned_to} /> until {formatDateTime(g.claim_expires_at)} — read-only for you.
        </div>
      )}
      {g.status === "resolved" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Resolved {formatDateTime(g.resolved_at)} — see history for the decision and merge events.
        </div>
      )}
      {g.status === "stale" && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Stale — inputs changed after a newer match run; decisions are disabled.
        </div>
      )}
      {versionConflict && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This group changed since you loaded it. <button className="font-medium underline" onClick={() => group.refetch()}>Reload</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Side-by-side comparison"
            description="Normalized identity fields on top, raw source values below. Green = all agree, red = conflicting values."
            actions={
              <div className="flex gap-1" role="tablist" aria-label="Group views">
                {([["compare", "Compare"], ["evidence", `Evidence (${g.matches.length})`], ["history", "History"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setTab(v)}
                    className={cn("rounded-md px-2.5 py-1 text-xs font-medium", tab === v ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100")}>
                    {l}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody>
            {tab === "compare" && <ComparisonTable group={g} />}
            {tab === "evidence" && <EvidencePanel group={g} />}
            {tab === "history" && <HistoryPanel id={g.id} />}
          </CardBody>
        </Card>

        <div className="space-y-6">
          {canDecide && open && (
            <Card>
              <CardHeader title="Decision" description="Applies to all pending pairs" />
              <CardBody className="space-y-2" data-testid="decision-panel">
                {DECISIONS.filter((d) => canApprove || d.key !== "approve").map((d) => (
                  <button key={d.key} onClick={() => { setDecision(d.key); if (d.key === "split") setSplit(Object.fromEntries(pending.map((m) => [String(m.id), canApprove ? "approve" : "reject"]))); }}
                    className={cn("flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      decision === d.key ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50")}>
                    <span className="flex items-center gap-2"><d.icon className="h-4 w-4" />{d.label}</span>
                  </button>
                ))}
                {!canApprove && <p className="pt-1 text-xs text-slate-500">Your role can reject or defer; approving merges requires the <code>review.approve</code> permission.</p>}
                {!claimedByMe && <p className="pt-1 text-xs text-slate-500">Deciding claims the group for you automatically if unclaimed.</p>}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Group details" />
            <CardBody>
              <KeyValues className="sm:grid-cols-1" items={[
                ["Confidence", <ConfidenceScore key="c" score={groupConfidence(g.matches)} />],
                ["Tier / scope", `${humanize(g.confidence_tier)} · ${humanize(g.scope)}`],
                ["Rule set", g.rule_set_version],
                ["Anchor record", <IdLink key="a" href={`/records/${g.anchor_record_id}`} id={g.anchor_record_id} />],
                ["Proposed master", <IdLink key="m" href={`/masters/${g.proposed_master_id}`} id={g.proposed_master_id} prefix="M-" />],
                ["Assigned to", <UserName key="u" id={g.assigned_to} />],
                ["Version", `v${g.version}`],
                ["Created", formatDateTime(g.created_at)],
                ["Resolved", formatDateTime(g.resolved_at)],
              ]} />
            </CardBody>
          </Card>

          {g.proposed_master && (
            <Card>
              <CardHeader title="Proposed golden record" />
              <CardBody>
                <KeyValues className="sm:grid-cols-1" items={[
                  ["Name", <Link key="n" href={`/masters/${g.proposed_master.id}`} className="font-medium text-brand-700 hover:underline">{masterName(g.proposed_master)}</Link>],
                  ["Email", g.proposed_master.primary_email],
                  ["LinkedIn", g.proposed_master.linkedin_url],
                  ["Status / version", `${humanize(g.proposed_master.status)} · v${g.proposed_master.version}`],
                ]} />
              </CardBody>
            </Card>
          )}

          {g.decisions.length > 0 && (
            <Card>
              <CardHeader title="Past decisions" />
              <CardBody className="space-y-2">
                {g.decisions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <StatusBadge status={d.decision} />
                    <span className="text-xs text-slate-500"><UserName id={d.reviewer_id} /> · {formatDateTime(d.created_at)}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={decision === "approve"}
        onClose={() => setDecision(null)}
        onConfirm={() => submit.mutate()}
        loading={submit.isPending}
        error={submit.error}
        tone="success"
        confirmLabel="Approve & merge"
        confirmDisabled={mergeNeedsTarget}
        title={`Approve all ${pending.length} pending match(es)?`}
        description="The records merge into one master record. This writes audit-logged merge events; original records are never modified and the merge is reversible."
      >
        <div className="space-y-3">
          {mergeOptions}
          <CommentField value={comment} onChange={setComment} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === "reject"}
        onClose={() => setDecision(null)}
        onConfirm={() => submit.mutate()}
        loading={submit.isPending}
        error={submit.error}
        tone="danger"
        confirmLabel="Reject all matches"
        title={`Reject all ${pending.length} pending match(es)?`}
        description="Every pair becomes a cannot-link constraint: the matcher will never propose them again."
      >
        <CommentField value={comment} onChange={setComment} required />
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === "split"}
        onClose={() => setDecision(null)}
        onConfirm={() => submit.mutate()}
        loading={submit.isPending}
        error={submit.error}
        confirmLabel="Submit split decision"
        confirmDisabled={splitHasApprovals && mergeNeedsTarget}
        title="Decide each pair"
      >
        <div className="space-y-2">
          {pending.map((m) => {
            const ra = g.records.find((r) => r.id === m.record_a_id);
            const rb = g.records.find((r) => r.id === m.record_b_id);
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-slate-900">{ra ? recordDisplayName(ra) : `#${m.record_a_id}`} ↔ {rb ? recordDisplayName(rb) : `#${m.record_b_id}`}</p>
                  <ConfidenceScore compact score={m.score} />
                </div>
                <div className="flex gap-1" role="group" aria-label={`Decision for match ${m.id}`}>
                  {(canApprove ? ["approve", "reject"] as const : ["reject"] as const).map((v) => (
                    <button key={v} onClick={() => setSplit({ ...split, [String(m.id)]: v })}
                      className={cn("rounded-md px-3 py-1.5 text-xs font-semibold",
                        split[String(m.id)] === v
                          ? v === "approve" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                      {v === "approve" ? "Approve" : "Reject"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {splitHasApprovals && mergeOptions}
          <CommentField value={comment} onChange={setComment} />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={decision === "defer"}
        onClose={() => setDecision(null)}
        onConfirm={() => submit.mutate()}
        loading={submit.isPending}
        error={submit.error}
        confirmLabel="Defer"
        title="Defer this group?"
        description="It returns to the pending queue. Reviewers will see your note."
      >
        <CommentField value={comment} onChange={setComment} required placeholder="Why is this being deferred?" />
      </ConfirmDialog>
    </>
  );
}

function CommentField({ value, onChange, required, placeholder }: {
  value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor="decision-comment" className="mb-1 block text-xs font-medium text-slate-700">
        Comment{required && <span className="text-red-500"> *</span>}
      </label>
      <Textarea id="decision-comment" rows={3} maxLength={5000} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Optional reviewer note (recorded in history)"} />
    </div>
  );
}
