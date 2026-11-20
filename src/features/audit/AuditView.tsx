"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ScrollText, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { UserName } from "@/components/ui/entities";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { cn, dateInputToIso, formatDateTime, formatNumber } from "@/lib/utils";
import type { AuditLog } from "@/types/api";

const ACTIONS = ["", "auth.", "user.", "dataset.", "upload.", "review.", "master.", "export."];

export function AuditView() {
  const { can } = useAuth();
  const toast = useToast();
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const list = usePagedQuery("audit", endpoints.auditLogs, {
    action: action || undefined, actor_id: actor || undefined, entity_type: entityType || undefined,
    entity_id: entityId || undefined, occurred_from: dateInputToIso(from), occurred_to: dateInputToIso(to, true),
  }, { enabled: can(Perm.AUDIT_READ) });

  const verify = useMutation({
    mutationFn: endpoints.verifyAudit,
    onSuccess: (v) => {
      if (v.valid) toast.success(`Hash chain intact`, `${formatNumber(v.checked)} entries verified.`);
      else toast.error("Hash chain broken", `${v.reason} (at log #${v.broken_at_id})`);
    },
    onError: (e) => toast.error("Verification failed", (e as Error).message),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: "when", header: "When", className: "whitespace-nowrap",
      cell: (l) => <button className="text-left text-slate-700 hover:text-brand-700" onClick={() => setSelected(l)}>{formatDateTime(l.occurred_at)}</button>,
    },
    { key: "action", header: "Action", cell: (l) => <Badge tone="indigo">{l.action}</Badge> },
    { key: "actor", header: "Actor", cell: (l) => <UserName id={l.actor_id} /> },
    { key: "entity", header: "Entity", cell: (l) => l.entity_type ? <span className="font-mono text-xs">{l.entity_type}#{l.entity_id}</span> : "—" },
    { key: "ip", header: "IP", cell: (l) => <span className="font-mono text-xs">{l.ip_address ?? "—"}</span> },
    { key: "req", header: "Request", cell: (l) => <span className="font-mono text-[11px] text-slate-400" title={l.request_id ?? undefined}>{l.request_id ? `${l.request_id.slice(0, 8)}…` : "—"}</span> },
    {
      key: "hash", header: "Chain", cell: (l) => (
        <span className="font-mono text-[11px] text-slate-400" title={l.hash}>{l.hash.slice(0, 10)}…</span>
      ),
    },
  ];

  return (
    <RequirePerm allowed={can(Perm.AUDIT_READ)}>
      <PageHeader title="Audit trail" description="Append-only, hash-chained record of every state change. Each entry links to the previous hash."
        actions={<Button variant="secondary" onClick={() => verify.mutate()} loading={verify.isPending}><CheckCircle2 className="h-4 w-4" />Verify chain</Button>} />
      <Card>
        <TableToolbar>
          <FilterField label="Action">
            {(id) => (
              <Select id={id} value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Actor user ID">{(id) => <Input id={id} inputMode="numeric" value={actor} onChange={(e) => setActor(e.target.value.replace(/\D/g, ""))} />}</FilterField>
          <FilterField label="Entity type">
            {(id) => (
              <Select id={id} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                <option value="">Any</option>
                {["user", "dataset", "upload", "record", "master_record", "duplicate_group", "export"].map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Entity ID">{(id) => <Input id={id} inputMode="numeric" value={entityId} onChange={(e) => setEntityId(e.target.value.replace(/\D/g, ""))} />}</FilterField>
          <FilterField label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</FilterField>
          <FilterField label="To">{(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</FilterField>
        </TableToolbar>
        <DataTable caption="Audit log" columns={columns} rows={list.items} rowKey={(l) => l.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()}
          empty={<EmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit entries match" />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={`Audit entry #${selected?.id}`} size="lg"
        description={selected ? `${selected.action} · ${formatDateTime(selected.occurred_at)}` : undefined}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-500">Actor</p><UserName id={selected.actor_id} /></div>
              <div><p className="text-xs text-slate-500">Entity</p>{selected.entity_type} #{selected.entity_id}</div>
              <div><p className="text-xs text-slate-500">IP</p><span className="font-mono text-xs">{selected.ip_address ?? "—"}</span></div>
              <div><p className="text-xs text-slate-500">Request</p><span className="font-mono text-xs">{selected.request_id ?? "—"}</span></div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Before</p>
              <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-3 font-mono text-xs">{JSON.stringify(selected.before_data, null, 2) || "null"}</pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">After</p>
              <pre className="max-h-40 overflow-auto rounded-md bg-slate-50 p-3 font-mono text-xs">{JSON.stringify(selected.after_data, null, 2) || "null"}</pre>
            </div>
            <div className={cn("rounded-md p-3 text-xs", "bg-slate-50")}>
              <p className="flex items-center gap-1.5 font-medium"><ShieldAlert className="h-3.5 w-3.5" /> Hash chain</p>
              <p className="mt-1 break-all font-mono text-slate-500">prev: {selected.prev_hash ?? "(genesis)"}</p>
              <p className="break-all font-mono text-slate-700">this: {selected.hash}</p>
            </div>
          </div>
        )}
      </Dialog>
    </RequirePerm>
  );
}
