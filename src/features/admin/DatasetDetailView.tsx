"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValues, StatCard } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { UserName } from "@/components/ui/entities";
import { EmptyState, ErrorState, InlineError, LoadingBlock } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { GroupsTable } from "@/features/review/ReviewQueueView";
import { RecordsTable } from "@/features/search/RecordsTable";
import { UploadsTable } from "@/features/uploads/UploadHistoryView";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hasDatasetLevel, LEVELS, Perm } from "@/lib/permissions";
import { formatDateTime, formatNumber, humanize } from "@/lib/utils";
import type { AccessLevel, Dataset } from "@/types/api";
import { DatasetFormDialog } from "./DatasetsView";

type Tab = "overview" | "uploads" | "records" | "groups" | "access";

function AccessEditor({ dataset }: { dataset: Dataset }) {
  const { can, me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const acl = useQuery({ queryKey: ["dataset-access", dataset.id], queryFn: () => endpoints.datasetAccess(dataset.id) });
  const users = useQuery({ queryKey: ["users", "acl-picker"], queryFn: () => endpoints.users({ status: "active", limit: 200 }), enabled: can(Perm.USER_MANAGE) });
  const [draft, setDraft] = useState<{ user_id: number; access_level: AccessLevel }[] | null>(null);
  const [newUser, setNewUser] = useState("");
  const [newLevel, setNewLevel] = useState<AccessLevel>("read");
  const entries = draft ?? acl.data?.map((e) => ({ user_id: e.user_id, access_level: e.access_level })) ?? [];
  const save = useMutation({
    mutationFn: () => endpoints.setDatasetAccess(dataset.id, entries),
    onSuccess: () => {
      setDraft(null);
      toast.success("Access updated", "Changes take effect immediately and are audited.");
      qc.invalidateQueries({ queryKey: ["dataset-access", dataset.id] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (acl.isLoading) return <LoadingBlock />;
  if (acl.error) return <ErrorState error={acl.error} onRetry={() => acl.refetch()} />;
  const candidates = users.data?.items.filter((u) => !entries.some((e) => e.user_id === u.id)) ?? [];
  const add = () => {
    const id = Number(newUser);
    if (!id || entries.some((e) => e.user_id === id)) return;
    setDraft([...entries, { user_id: id, access_level: newLevel }]);
    setNewUser("");
  };

  return (
    <Card>
      <CardHeader title="User access" description="Direct per-user grants: read < upload < review < manage. Admins always have full access."
        actions={draft && <><Button variant="secondary" onClick={() => setDraft(null)}>Discard</Button><Button onClick={() => save.mutate()} loading={save.isPending}>Save changes</Button></>} />
      <CardBody className="space-y-4">
        <InlineError error={save.error} />
        {entries.length === 0 ? <p className="text-sm text-slate-500">No explicit grants.</p> : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {entries.map((e) => (
              <li key={e.user_id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 text-sm"><UserName id={e.user_id} /> <span className="font-mono text-xs text-slate-400">#{e.user_id}</span></div>
                <Select aria-label={`Access level for user ${e.user_id}`} className="w-36" value={e.access_level}
                  onChange={(ev) => setDraft(entries.map((x) => (x.user_id === e.user_id ? { ...x, access_level: ev.target.value as AccessLevel } : x)))}>
                  {LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}
                </Select>
                <button aria-label={`Remove user ${e.user_id}`} disabled={e.user_id === me?.id && e.access_level === "manage" && !me?.is_admin}
                  onClick={() => setDraft(entries.filter((x) => x.user_id !== e.user_id))}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <FilterField label="Add user" className="min-w-[16rem] flex-1">
            {(id) => can(Perm.USER_MANAGE) ? (
              <Select id={id} value={newUser} onChange={(e) => setNewUser(e.target.value)}>
                <option value="">Select a user…</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>)}
              </Select>
            ) : <Input id={id} inputMode="numeric" placeholder="User ID" value={newUser} onChange={(e) => setNewUser(e.target.value.replace(/\D/g, ""))} />}
          </FilterField>
          <FilterField label="Level">
            {(id) => <Select id={id} value={newLevel} onChange={(e) => setNewLevel(e.target.value as AccessLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}</Select>}
          </FilterField>
          <Button variant="secondary" onClick={add} disabled={!newUser}><Plus className="h-4 w-4" />Add</Button>
        </div>
      </CardBody>
    </Card>
  );
}

function TeamAccessCard({ dataset }: { dataset: Dataset }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const grants = useQuery({ queryKey: ["dataset-teams", dataset.id], queryFn: () => endpoints.datasetTeams(dataset.id) });
  // team.manage holders can pick any team; others only teams they belong to.
  const teams = useQuery({ queryKey: ["teams", "grant-picker"], queryFn: () => endpoints.teams({ status: "active", limit: 200 }) });
  const [newTeam, setNewTeam] = useState("");
  const [newLevel, setNewLevel] = useState<AccessLevel>("read");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["dataset-teams", dataset.id] });
    qc.invalidateQueries({ queryKey: ["me"] });
  };
  const set = useMutation({
    mutationFn: ({ team, level }: { team: number; level: AccessLevel }) => endpoints.setTeamGrant(team, dataset.id, level),
    onSuccess: () => { setNewTeam(""); toast.success("Team access updated", "Applies to every team member immediately."); refresh(); },
    onError: (e) => toast.error("Could not update team access", (e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (team: number) => endpoints.removeTeamGrant(team, dataset.id),
    onSuccess: () => { toast.success("Team access revoked"); refresh(); },
    onError: (e) => toast.error("Could not revoke", (e as Error).message),
  });

  if (grants.isLoading) return <LoadingBlock />;
  if (grants.error) return <ErrorState error={grants.error} onRetry={() => grants.refetch()} />;
  const rows = grants.data ?? [];
  const candidates = teams.data?.items.filter((t) => !rows.some((g) => g.team_id === t.id)) ?? [];

  return (
    <Card>
      <CardHeader title="Team access" description="Every member of an active team gets this level. Effective access is the highest of a user's own and team grants." />
      <CardBody className="space-y-4">
        {rows.length === 0 ? <p className="text-sm text-slate-500">No teams have access.</p> : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {rows.map((g) => (
              <li key={g.team_id} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 text-sm">
                  <Link href={`/admin/teams/${g.team_id}`} className="text-brand-700 hover:underline">{g.team_name}</Link>
                  {g.team_status === "archived" && <Badge tone="gray" className="ml-2">archived · suspended</Badge>}
                </div>
                <Select aria-label={`Access level for team ${g.team_name}`} className="w-36" value={g.access_level}
                  onChange={(e) => set.mutate({ team: g.team_id, level: e.target.value as AccessLevel })}>
                  {LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}
                </Select>
                <button aria-label={`Revoke team ${g.team_name}`} onClick={() => remove.mutate(g.team_id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-slate-50 p-3">
          <FilterField label="Add team" className="min-w-[16rem] flex-1">
            {(id) => (
              <Select id={id} value={newTeam} onChange={(e) => setNewTeam(e.target.value)}>
                <option value="">{candidates.length ? "Select a team…" : can(Perm.TEAM_MANAGE) ? "No more teams" : "Only teams you belong to"}</option>
                {candidates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Level">
            {(id) => <Select id={id} value={newLevel} onChange={(e) => setNewLevel(e.target.value as AccessLevel)}>{LEVELS.map((l) => <option key={l} value={l}>{humanize(l)}</option>)}</Select>}
          </FilterField>
          <Button variant="secondary" onClick={() => set.mutate({ team: Number(newTeam), level: newLevel })} disabled={!newTeam} loading={set.isPending}><Plus className="h-4 w-4" />Grant</Button>
        </div>
      </CardBody>
    </Card>
  );
}

export function DatasetDetailView({ id }: { id: number }) {
  const { me, can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ds = useQuery({ queryKey: ["dataset", id], queryFn: () => endpoints.dataset(id) });
  const records = usePagedQuery("records", endpoints.records, { dataset_id: id }, { enabled: tab === "records" });
  const toggleArchive = useMutation({
    mutationFn: () => endpoints.updateDataset(id, { status: ds.data?.status === "active" ? "archived" : "active" }),
    onSuccess: (d) => {
      setArchiving(false);
      toast.success(d.status === "archived" ? "Dataset archived" : "Dataset reactivated");
      qc.invalidateQueries({ queryKey: ["dataset", id] });
      qc.invalidateQueries({ queryKey: ["datasets"] });
      qc.invalidateQueries({ queryKey: ["datasets-all"] });
    },
  });
  const del = useMutation({
    mutationFn: () => endpoints.deleteDataset(id),
    onSuccess: () => {
      toast.success("Dataset deleted");
      qc.invalidateQueries({ queryKey: ["datasets"] });
      qc.invalidateQueries({ queryKey: ["datasets-all"] });
      router.push("/datasets");
    },
  });

  if (ds.isLoading) return <LoadingBlock />;
  if (ds.error || !ds.data) return <Card><ErrorState error={ds.error} onRetry={() => ds.refetch()} /></Card>;
  const d = ds.data;
  const manage = hasDatasetLevel(me, d.id, "manage");
  const canUpload = can(Perm.UPLOAD_CREATE) && hasDatasetLevel(me, d.id, "upload") && d.status === "active";

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: "/datasets", label: "Datasets" }, { href: `/datasets/${d.id}`, label: d.name }]}
        title={<span className="flex items-center gap-3">{d.name} <StatusBadge status={d.status} /></span>}
        description={d.description ?? "No description."}
        actions={
          <>
            {canUpload && <ButtonLink href={`/uploads/new?dataset=${d.id}`}><Upload className="h-4 w-4" />Upload</ButtonLink>}
            {manage && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" />Edit</Button>}
            {manage && (
              <Button variant="secondary" onClick={() => setArchiving(true)}>
                {d.status === "active" ? <><Archive className="h-4 w-4" />Archive</> : <><ArchiveRestore className="h-4 w-4" />Reactivate</>}
              </Button>
            )}
            {manage && (d.upload_count ?? 0) === 0 && (
              <Button variant="danger" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" />Delete</Button>
            )}
          </>
        }
      />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview" },
        { value: "uploads", label: `Uploads (${formatNumber(d.upload_count)})`, hidden: !can(Perm.UPLOAD_READ) },
        { value: "records", label: "Records", hidden: !can(Perm.RECORD_READ) },
        { value: "groups", label: "Duplicate groups", hidden: !can(Perm.GROUP_READ) },
        { value: "access", label: "Access", hidden: !manage },
      ]} />

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Details" />
            <CardBody>
              <KeyValues items={[
                ["Dataset ID", <span key="i" className="font-mono">{d.id}</span>],
                ["Status", <StatusBadge key="s" status={d.status} />],
                ["Your access", d.my_access_level ? <Badge key="a" tone="indigo">{humanize(d.my_access_level)}</Badge> : "—"],
                ["Created by", <UserName key="c" id={d.created_by} />],
                ["Created", formatDateTime(d.created_at)],
                ["Last updated", formatDateTime(d.updated_at)],
              ]} />
              {d.status === "archived" && <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">Archived datasets are read-only: new uploads are rejected. History remains fully available.</p>}
            </CardBody>
          </Card>
          <StatCard label="Uploads" value={formatNumber(d.upload_count)} hint="Original files, never modified" icon={<Upload className="h-5 w-5" />} />
        </div>
      )}
      {tab === "uploads" && <Card><UploadsTable datasetId={d.id} showDatasetFilter={false} /></Card>}
      {tab === "records" && (
        <Card>
          <RecordsTable rows={records.items} isLoading={records.isLoading} isFetching={records.isFetching} error={records.error}
            onRetry={() => records.refetch()} pager={records.pager} nextCursor={records.nextCursor}
            empty={<EmptyState title="No records in this dataset yet" />} />
        </Card>
      )}
      {tab === "groups" && <Card><GroupsTable fixed={{ dataset_id: d.id }} /></Card>}
      {tab === "access" && manage && (
        <div className="space-y-6">
          <AccessEditor dataset={d} />
          <TeamAccessCard dataset={d} />
        </div>
      )}

      {editing && <DatasetFormDialog open dataset={d} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={archiving} onClose={() => setArchiving(false)} onConfirm={() => toggleArchive.mutate()}
        loading={toggleArchive.isPending} error={toggleArchive.error}
        title={d.status === "active" ? "Archive this dataset?" : "Reactivate this dataset?"}
        description={d.status === "active" ? "No new uploads will be accepted. Existing uploads, records and history stay intact and readable." : "The dataset will accept new uploads again."}
        confirmLabel={d.status === "active" ? "Archive" : "Reactivate"} tone={d.status === "active" ? "danger" : "primary"} />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => del.mutate()}
        loading={del.isPending} error={del.error}
        title="Delete this dataset?"
        description="Permanently removes the dataset and its access grants. Only empty datasets can be deleted — archive it to keep history."
        confirmLabel="Delete" tone="danger" />
    </>
  );
}
