"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, KeyRound, Lock, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Field, Input, Textarea } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, InlineError, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { cn, formatNumber, humanize } from "@/lib/utils";
import type { PermissionInfo, RoleInfo } from "@/types/api";

function byCategory(perms: PermissionInfo[]): [string, PermissionInfo[]][] {
  const out = new Map<string, PermissionInfo[]>();
  for (const p of perms) out.set(p.category, [...(out.get(p.category) ?? []), p]);
  return [...out.entries()];
}

function RoleDialog({ role, perms, onClose }: { role?: RoleInfo; perms: PermissionInfo[]; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [key, setKey] = useState(role?.role ?? "");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const validKey = /^[a-z][a-z0-9_]{1,49}$/.test(key);
  const save = useMutation({
    mutationFn: () => (role
      ? endpoints.updateRole(role.role, { name: name.trim(), description: description.trim(), permissions: [...selected] })
      : endpoints.createRole({ key, name: name.trim(), description: description.trim() || undefined, permissions: [...selected] })),
    onSuccess: () => {
      toast.success(role ? "Role updated" : "Role created", "Permission changes apply to every holder on their next request.");
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    },
  });
  const toggle = (k: string) => setSelected((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <Dialog open onClose={onClose} title={role ? `Edit role: ${role.name}` : "New custom role"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim() || (!role && !validKey)}>{role ? "Save" : "Create role"}</Button></>}>
      <div className="space-y-4">
        {!role && (
          <Field label="Key" required hint="Lowercase letters, digits and _ (e.g. data_steward). Cannot be changed later."
            error={key && !validKey ? "Invalid key format." : undefined}>
            {(id) => <Input id={id} value={key} maxLength={50} onChange={(e) => setKey(e.target.value.toLowerCase())} />}
          </Field>
        )}
        <Field label="Display name" required>{(id) => <Input id={id} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} rows={2} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Permissions <span className="font-normal text-slate-400">({selected.size} selected)</span></p>
          {!role?.is_system && <p className="mb-2 text-xs text-slate-500">Custom roles never bypass dataset access control.</p>}
          <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
            {byCategory(perms).map(([cat, items]) => (
              <fieldset key={cat}>
                <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{humanize(cat)}</legend>
                <div className="space-y-1">
                  {items.map((p) => (
                    <label key={p.key} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
                      <span><span className="font-mono text-xs text-slate-700">{p.key}</span> <span className="text-slate-500">— {p.description}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}

export function RolesView() {
  const { can } = useAuth();
  const roles = useQuery({ queryKey: ["roles"], queryFn: endpoints.roles });
  const perms = useQuery({ queryKey: ["permissions"], queryFn: endpoints.permissions });
  const [editing, setEditing] = useState<RoleInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const manage = can(Perm.ROLE_MANAGE);
  const groups = useMemo(() => byCategory(perms.data ?? []), [perms.data]);

  if (roles.isLoading || perms.isLoading) return <LoadingBlock />;
  if (roles.error || perms.error) return <Card><ErrorState error={roles.error ?? perms.error} onRetry={() => { roles.refetch(); perms.refetch(); }} /></Card>;
  const rs = roles.data ?? [];

  return (
    <>
      <PageHeader title="Roles & permissions"
        description="Each user has one role; a role is a set of granular permissions. Dataset access (direct or via teams) is checked in addition."
        actions={manage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New role</Button>} />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rs.map((r) => (
          <Card key={r.role}>
            <CardBody>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    {r.name}
                    {r.is_admin && <Badge tone="indigo">admin · bypasses dataset ACL</Badge>}
                    {!r.is_system && <Badge tone="violet">custom</Badge>}
                  </p>
                  <p className="font-mono text-xs text-slate-400">{r.role}</p>
                </div>
                {manage && r.editable ? (
                  <Button size="sm" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                ) : !r.editable && <Lock className="h-4 w-4 text-slate-300" aria-label="Not editable" />}
              </div>
              {r.description && <p className="mt-2 text-sm text-slate-600">{r.description}</p>}
              <p className="mt-2 text-xs text-slate-500">
                {formatNumber(r.permissions.length)} permissions{r.user_count != null && ` · ${formatNumber(r.user_count)} user(s)`}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader title="Permission matrix" description="Which role holds which permission" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Permission</th>
                {rs.map((r) => <th key={r.role} scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">{r.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map(([cat, items]) => [
                <tr key={`cat-${cat}`} className="bg-slate-50/60">
                  <th colSpan={rs.length + 1} scope="colgroup" className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{humanize(cat)}</th>
                </tr>,
                ...items.map((p) => (
                  <tr key={p.key}>
                    <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-normal">
                      <span className="flex items-center gap-1.5 font-mono text-xs text-slate-800"><KeyRound className="h-3 w-3 text-slate-300" />{p.key}</span>
                      <span className="text-xs text-slate-500">{p.description}</span>
                    </th>
                    {rs.map((r) => (
                      <td key={r.role} className="px-3 py-2 text-center">
                        <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full",
                          r.permissions.includes(p.key) ? "bg-emerald-100 text-emerald-700" : "text-slate-200")}
                          aria-label={r.permissions.includes(p.key) ? `${r.name} has ${p.key}` : `${r.name} lacks ${p.key}`}>
                          {r.permissions.includes(p.key) ? <Check className="h-3.5 w-3.5" /> : "·"}
                        </span>
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      {(creating || editing) && (
        <RoleDialog role={editing ?? undefined} perms={perms.data ?? []} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </>
  );
}
