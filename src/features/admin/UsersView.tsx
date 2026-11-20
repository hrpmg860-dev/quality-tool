"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, ShieldOff, Users } from "lucide-react";
import { useState } from "react";
import { Field, FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canAssignRole, Perm, roleLabel } from "@/lib/permissions";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { Role, User } from "@/types/api";

export function UserDialog({ open, onClose, user }: { open: boolean; onClose: () => void; user?: User }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const roles = useQuery({ queryKey: ["roles"], queryFn: endpoints.roles });
  const teams = useQuery({ queryKey: ["user-teams", user?.id], queryFn: () => endpoints.userTeams(user!.id), enabled: !!user });
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.display_name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "viewer");
  const [password, setPassword] = useState("");
  const save = useMutation({
    mutationFn: () => (user
      ? endpoints.updateUser(user.id, { display_name: name.trim(), role })
      : endpoints.createUser({ email: email.trim(), display_name: name.trim(), role, password: password || undefined })),
    onSuccess: () => {
      toast.success(user ? "User updated" : "User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });
  // Only roles the caller could grant without escalating (server re-checks);
  // always keep the user's current role visible.
  const allowedRoles = (roles.data ?? []).filter((r) => canAssignRole(me, r) || r.role === user?.role);

  return (
    <Dialog open={open} onClose={onClose} title={user ? `Edit ${user.display_name}` : "Invite user"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim() || (!user && !email.trim())}>{user ? "Save" : "Create user"}</Button></>}>
      <div className="space-y-4">
        {!user && (
          <Field label="Email" required hint="Must be unique among active accounts.">
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}
        <Field label="Display name" required>
          {(id) => <Input id={id} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Role" required hint={user?.id === me?.id ? "You cannot change your own role." : undefined}>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={user?.id === me?.id}>
              {allowedRoles.map((r) => <option key={r.role} value={r.role}>{r.name}{r.is_admin ? " · admin" : ""}{r.is_system ? "" : " · custom"}</option>)}
            </Select>
          )}
        </Field>
        {!user && (
          <Field label="Password" required={!!email} hint="Min 10 chars, at least one letter and one digit.">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
        )}
        {user && (
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p><span className="font-medium">Role grants:</span> {[...(roles.data?.find((r) => r.role === role)?.permissions ?? [])].sort().join(", ")}</p>
            <p className="mt-1"><span className="font-medium">Teams:</span> {teams.data?.length ? teams.data.map((t) => `${t.name}${t.team_role === "lead" ? " (lead)" : ""}`).join(", ") : "none"}</p>
            <p className="mt-1">Dataset-level access is granted per dataset (Datasets → Access) or through teams (Administration → Teams).</p>
          </div>
        )}
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}

export function UsersView() {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<User | null>(null);
  const dq = useDebounced(q);
  const roles = useQuery({ queryKey: ["roles"], queryFn: endpoints.roles });

  const list = usePagedQuery("users", endpoints.users, { q: dq, role: role || undefined, status: status || undefined },
    { enabled: can(Perm.USER_MANAGE) });
  const deactivate = useMutation({
    mutationFn: (id: number) => endpoints.deactivateUser(id),
    onSuccess: () => {
      setDeactivating(null);
      toast.success("User deactivated", "Their sessions are revoked; history is retained.");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const columns: Column<User>[] = [
    {
      key: "user", header: "User", cell: (u) => (
        <div className="min-w-[12rem]">
          <p className="font-medium text-slate-900">{u.display_name}{u.id === me?.id && <Badge tone="indigo" className="ml-2">you</Badge>}</p>
          <p className="text-xs text-slate-500">{u.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Role", cell: (u) => <Badge tone={roles.data?.find((r) => r.role === u.role)?.is_admin ? "indigo" : "gray"}>{roleLabel(u.role, roles.data)}</Badge> },
    { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
    { key: "provider", header: "Auth", cell: (u) => <span className="text-xs">{u.auth_provider}</span> },
    { key: "login", header: "Last login", className: "whitespace-nowrap", cell: (u) => formatDateTime(u.last_login_at) },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (u) => formatDateTime(u.created_at) },
    {
      key: "actions", header: "", headerClassName: "w-32 text-right", className: "text-right",
      cell: (u) => (
        <span className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Edit ${u.display_name}`} onClick={() => setEditing(u)}><Pencil className="h-3.5 w-3.5" /></Button>
          {u.status === "active" && u.id !== me?.id && (
            <Button size="sm" variant="ghost" aria-label={`Deactivate ${u.display_name}`} onClick={() => setDeactivating(u)}><ShieldOff className="h-3.5 w-3.5" /></Button>
          )}
        </span>
      ),
    },
  ];

  return (
    <RequirePerm allowed={can(Perm.USER_MANAGE)}>
      <PageHeader title="User management" description="Roles and account status. Users are never deleted — deactivated accounts lose access but keep their history."
        actions={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New user</Button>} />
      <Card>
        <TableToolbar>
          <FilterField label="Search" className="min-w-[14rem] flex-1">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input id={id} className="pl-8" placeholder="Name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
          </FilterField>
          <FilterField label="Role">
            {(id) => (
              <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Any</option>
                {(roles.data ?? []).map((r) => <option key={r.role} value={r.role}>{r.name}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any</option><option value="active">Active</option><option value="invited">Invited</option><option value="deactivated">Deactivated</option>
              </Select>
            )}
          </FilterField>
        </TableToolbar>
        <DataTable caption="Users" columns={columns} rows={list.items} rowKey={(u) => u.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()}
          empty={<EmptyState icon={<Users className="h-6 w-6" />} title="No users match" />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>
      {creating && <UserDialog open onClose={() => setCreating(false)} />}
      {editing && <UserDialog open user={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!deactivating} onClose={() => setDeactivating(null)} onConfirm={() => deactivate.mutate(deactivating!.id)}
        loading={deactivate.isPending} error={deactivate.error} tone="danger" confirmLabel="Deactivate"
        title={`Deactivate ${deactivating?.display_name}?`}
        description="They are signed out immediately and cannot log in. Their uploads, decisions and audit entries remain attributed to them." />
    </RequirePerm>
  );
}
