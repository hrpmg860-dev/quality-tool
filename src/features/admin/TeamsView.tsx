"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FilterField, Input, Select, Textarea } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DatasetName, useDatasets, UserName } from "@/components/ui/entities";
import { EmptyState, ErrorState, InlineError, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { datasetsWithLevel, LEVELS, Perm, roleLabel } from "@/lib/permissions";
import { formatDate, formatDateTime, formatNumber, humanize } from "@/lib/utils";
import type { AccessLevel, Team, TeamMember, TeamRole } from "@/types/api";

function TeamFormDialog({ open, onClose, team }: { open: boolean; onClose: () => void; team?: Team }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const save = useMutation({
    mutationFn: () => (team
      ? endpoints.updateTeam(team.id, { name: name.trim(), description: description.trim() })
      : endpoints.createTeam({ name: name.trim(), description: description.trim() || undefined })),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team", t.id] });
      toast.success(team ? "Team updated" : "Team created");
      onClose();
      if (!team) router.push(`/admin/teams/${t.id}`);
    },
  });
  return (
    <Dialog open={open} onClose={onClose} title={team ? "Edit team" : "New team"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>{team ? "Save" : "Create"}</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required hint="Unique (case-insensitive).">{(id) => <Input id={id} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} rows={3} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}

export function TeamsView() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const list = usePagedQuery("teams", endpoints.teams, { q: dq || undefined, status: status || undefined });
  const manager = can(Perm.TEAM_MANAGE);

  const columns: Column<Team>[] = [
    {
      key: "name", header: "Team", cell: (t) => (
        <div className="min-w-[14rem]">
          <Link href={`/admin/teams/${t.id}`} className="font-medium text-slate-900 hover:text-brand-700">{t.name}</Link>
          {t.description && <p className="max-w-md truncate text-xs text-slate-500">{t.description}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
    { key: "members", header: "Members", className: "tabular-nums", cell: (t) => formatNumber(t.member_count) },
    { key: "mine", header: "You", cell: (t) => (t.my_team_role ? <Badge tone="indigo">{humanize(t.my_team_role)}</Badge> : "—") },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (t) => formatDate(t.created_at) },
  ];

  return (
    <>
      <PageHeader title="Teams"
        description={manager
          ? "Group users and grant datasets to the whole team. Members get the highest of their own and their teams' dataset access."
          : "Teams you belong to. Dataset access granted to a team applies to every member."}
        actions={manager && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New team</Button>} />
      <Card>
        <TableToolbar>
          <FilterField label="Search" className="min-w-[14rem] flex-1">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input id={id} className="pl-8" placeholder="Team name or description…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            )}
          </FilterField>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any</option><option value="active">Active</option><option value="archived">Archived</option>
              </Select>
            )}
          </FilterField>
        </TableToolbar>
        <DataTable caption="Teams" columns={columns} rows={list.items} rowKey={(t) => t.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()}
          empty={<EmptyState icon={<UsersRound className="h-6 w-6" />} title="No teams" description={manager ? "Create a team to share datasets with a group." : "You are not a member of any team."} />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>
      {creating && <TeamFormDialog open onClose={() => setCreating(false)} />}
    </>
  );
}

function MembersCard({ team }: { team: Team }) {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const manager = can(Perm.TEAM_MANAGE);
  const isLead = team.my_team_role === "lead";
  const canEdit = (manager || isLead) && (manager || team.status === "active");
  const members = useQuery({ queryKey: ["team-members", team.id], queryFn: () => endpoints.teamMembers(team.id) });
  const users = useQuery({ queryKey: ["users", "team-picker"], queryFn: () => endpoints.users({ status: "active", limit: 200 }), enabled: canEdit && can(Perm.USER_MANAGE) });
  const roles = useQuery({ queryKey: ["roles"], queryFn: endpoints.roles });
  const [newUser, setNewUser] = useState("");
  const [newRole, setNewRole] = useState<TeamRole>("member");
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["team-members", team.id] });
    qc.invalidateQueries({ queryKey: ["team", team.id] });
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  const set = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: TeamRole }) => endpoints.setTeamMember(team.id, userId, role),
    onSuccess: () => { setNewUser(""); toast.success("Membership updated", "Dataset access changes immediately."); refresh(); },
    onError: (e) => toast.error("Could not update membership", (e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (userId: number) => endpoints.removeTeamMember(team.id, userId),
    onSuccess: () => { setRemoving(null); toast.success("Member removed"); refresh(); },
  });

  const rows = members.data ?? [];
  const candidates = users.data?.items.filter((u) => !rows.some((m) => m.user_id === u.id)) ?? [];
  // Leads may only manage plain members.
  const editable = (m: TeamMember) => canEdit && (manager || m.team_role !== "lead");

  const columns: Column<TeamMember>[] = [
    {
      key: "user", header: "Member", cell: (m) => (
        <div>
          <p className="font-medium text-slate-900">{m.display_name}{m.user_id === me?.id && <Badge tone="indigo" className="ml-2">you</Badge>}</p>
          <p className="text-xs text-slate-500">{m.email}</p>
        </div>
      ),
    },
    { key: "role", header: "Platform role", cell: (m) => <Badge tone="gray">{roleLabel(m.role, roles.data)}</Badge> },
    {
      key: "team_role", header: "Team role", cell: (m) => (manager ? (
        <Select aria-label={`Team role for ${m.display_name}`} className="w-32" value={m.team_role}
          onChange={(e) => set.mutate({ userId: m.user_id, role: e.target.value as TeamRole })}>
          <option value="member">Member</option><option value="lead">Lead</option>
        </Select>
      ) : <Badge tone={m.team_role === "lead" ? "indigo" : "gray"}>{humanize(m.team_role)}</Badge>),
    },
    { key: "status", header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
    { key: "added", header: "Added", className: "whitespace-nowrap", cell: (m) => formatDateTime(m.created_at) },
    {
      key: "actions", header: "", headerClassName: "w-16 text-right", className: "text-right",
      cell: (m) => editable(m) && (
        <Button size="sm" variant="ghost" aria-label={`Remove ${m.display_name}`} onClick={() => setRemoving(m)}><Trash2 className="h-3.5 w-3.5" /></Button>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader title={`Members (${rows.length})`}
        description={manager ? "Leads can add and remove members." : isLead ? "As a lead you can add and remove members." : undefined} />
      <DataTable caption="Team members" columns={columns} rows={members.data} rowKey={(m) => m.user_id}
        isLoading={members.isLoading} isFetching={members.isFetching} error={members.error} onRetry={() => members.refetch()}
        empty={<EmptyState icon={<UsersRound className="h-6 w-6" />} title="No members yet" />} />
      {canEdit && (
        <CardBody className="border-t border-slate-100">
          <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
            <FilterField label="Add member" className="min-w-[16rem] flex-1">
              {(id) => can(Perm.USER_MANAGE) ? (
                <Select id={id} value={newUser} onChange={(e) => setNewUser(e.target.value)}>
                  <option value="">Select a user…</option>
                  {candidates.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>)}
                </Select>
              ) : <Input id={id} inputMode="numeric" placeholder="User ID" value={newUser} onChange={(e) => setNewUser(e.target.value.replace(/\D/g, ""))} />}
            </FilterField>
            {manager && (
              <FilterField label="Team role">
                {(id) => <Select id={id} value={newRole} onChange={(e) => setNewRole(e.target.value as TeamRole)}><option value="member">Member</option><option value="lead">Lead</option></Select>}
              </FilterField>
            )}
            <Button variant="secondary" disabled={!newUser} loading={set.isPending}
              onClick={() => set.mutate({ userId: Number(newUser), role: manager ? newRole : "member" })}>
              <Plus className="h-4 w-4" />Add
            </Button>
          </div>
        </CardBody>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} onConfirm={() => remove.mutate(removing!.user_id)}
        loading={remove.isPending} error={remove.error} tone="danger" confirmLabel="Remove"
        title={`Remove ${removing?.display_name} from ${team.name}?`}
        description="They immediately lose any dataset access that came only from this team. The change is audited." />
    </Card>
  );
}

function GrantsCard({ team }: { team: Team }) {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const grants = useQuery({ queryKey: ["team-grants", team.id], queryFn: () => endpoints.teamGrants(team.id) });
  const datasets = useDatasets();
  const [newDs, setNewDs] = useState("");
  const [newLevel, setNewLevel] = useState<AccessLevel>("read");
  // Grants need manage on the dataset (+ team.manage or membership — already implied by seeing the team).
  const manageable = datasetsWithLevel(me, datasets.data ?? [], "manage");
  const canGrant = (dsId: number) => manageable.some((d) => d.id === dsId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["team-grants", team.id] });
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["datasets"] });
  };
  const set = useMutation({
    mutationFn: ({ ds, level }: { ds: number; level: AccessLevel }) => endpoints.setTeamGrant(team.id, ds, level),
    onSuccess: () => { setNewDs(""); toast.success("Team access updated", "Applies to every member immediately."); refresh(); },
    onError: (e) => toast.error("Could not update access", (e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (ds: number) => endpoints.removeTeamGrant(team.id, ds),
    onSuccess: () => { toast.success("Team access revoked"); refresh(); },
    onError: (e) => toast.error("Could not revoke access", (e as Error).message),
  });

  if (grants.isLoading) return <Card><LoadingBlock /></Card>;
  if (grants.error) return <Card><ErrorState error={grants.error} onRetry={() => grants.refetch()} /></Card>;
  const rows = grants.data ?? [];
  const candidates = manageable.filter((d) => !rows.some((g) => g.dataset_id === d.id));

  return (
    <Card>
      <CardHeader title="Dataset access" description={team.status === "archived" ? "Team is archived — these grants are suspended." : "read < upload < review < manage. Role permissions still apply."} />
      <CardBody className="space-y-4">
        {rows.length === 0 ? <p className="text-sm text-slate-500">This team has no dataset grants.</p> : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {rows.map((g) => (
              <li key={g.dataset_id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 text-sm"><DatasetName id={g.dataset_id} /></div>
                {canGrant(g.dataset_id) ? (
                  <>
                    <Select aria-label={`Team access level for dataset ${g.dataset_id}`} className="w-36" value={g.access_level}
                      onChange={(e) => set.mutate({ ds: g.dataset_id, level: e.target.value as AccessLevel })}>
                      {LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}
                    </Select>
                    <button aria-label={`Revoke dataset ${g.dataset_id}`} onClick={() => remove.mutate(g.dataset_id)}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </>
                ) : <Badge tone="indigo">{humanize(g.access_level)}</Badge>}
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
            <FilterField label="Grant dataset" className="min-w-[14rem] flex-1">
              {(id) => (
                <Select id={id} value={newDs} onChange={(e) => setNewDs(e.target.value)}>
                  <option value="">Select a dataset…</option>
                  {candidates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              )}
            </FilterField>
            <FilterField label="Level">
              {(id) => <Select id={id} value={newLevel} onChange={(e) => setNewLevel(e.target.value as AccessLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}</Select>}
            </FilterField>
            <Button variant="secondary" disabled={!newDs} loading={set.isPending}
              onClick={() => set.mutate({ ds: Number(newDs), level: newLevel })}><Plus className="h-4 w-4" />Grant</Button>
          </div>
        )}
        {!can(Perm.TEAM_MANAGE) && candidates.length === 0 && rows.length === 0 && (
          <p className="text-xs text-slate-500">Dataset managers who are team members can share their datasets with the team.</p>
        )}
      </CardBody>
    </Card>
  );
}

export function TeamDetailView({ id }: { id: number }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const team = useQuery({ queryKey: ["team", id], queryFn: () => endpoints.team(id) });
  const toggle = useMutation({
    mutationFn: () => endpoints.updateTeam(id, { status: team.data?.status === "active" ? "archived" : "active" }),
    onSuccess: (t) => {
      setArchiving(false);
      toast.success(t.status === "archived" ? "Team archived" : "Team reactivated");
      qc.invalidateQueries({ queryKey: ["team", id] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (team.isLoading) return <LoadingBlock />;
  if (team.error || !team.data) return <Card><ErrorState error={team.error} onRetry={() => team.refetch()} /></Card>;
  const t = team.data;
  const manager = can(Perm.TEAM_MANAGE);

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/admin/teams", label: "Teams" }, { href: `/admin/teams/${t.id}`, label: t.name }]}
        title={<span className="flex items-center gap-3">{t.name} <StatusBadge status={t.status} /></span>}
        description={t.description ?? "No description."}
        actions={manager && (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>
            <Button variant="secondary" onClick={() => setArchiving(true)}>
              {t.status === "active" ? <><Archive className="h-4 w-4" />Archive</> : <><ArchiveRestore className="h-4 w-4" />Reactivate</>}
            </Button>
          </>
        )}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <MembersCard team={t} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <KeyValues className="sm:grid-cols-1" items={[
                ["Team ID", <span key="i" className="font-mono">{t.id}</span>],
                ["Members", formatNumber(t.member_count)],
                ["Your team role", t.my_team_role ? humanize(t.my_team_role) : "—"],
                ["Created by", <UserName key="c" id={t.created_by} />],
                ["Created", formatDateTime(t.created_at)],
              ]} />
            </CardBody>
          </Card>
          <GrantsCard team={t} />
        </div>
      </div>
      {editing && <TeamFormDialog open team={t} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={archiving} onClose={() => setArchiving(false)} onConfirm={() => toggle.mutate()}
        loading={toggle.isPending} error={toggle.error}
        title={t.status === "active" ? "Archive this team?" : "Reactivate this team?"}
        description={t.status === "active"
          ? "Members keep their membership, but dataset access granted through this team is suspended. Teams are never deleted."
          : "Dataset grants of this team apply to its members again."}
        confirmLabel={t.status === "active" ? "Archive" : "Reactivate"} tone={t.status === "active" ? "danger" : "primary"} />
    </>
  );
}
