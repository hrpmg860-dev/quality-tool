"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FilterField, Input, Select, Textarea } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { type Column, DataTable, Pagination, TableToolbar } from "@/components/tables/DataTable";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { UserName } from "@/components/ui/entities";
import { EmptyState, InlineError } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";
import { formatDate, formatNumber, humanize } from "@/lib/utils";
import type { Dataset } from "@/types/api";

export function DatasetFormDialog({ open, onClose, dataset }: { open: boolean; onClose: () => void; dataset?: Dataset }) {
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(dataset?.name ?? "");
  const [description, setDescription] = useState(dataset?.description ?? "");
  const save = useMutation({
    mutationFn: () => (dataset
      ? endpoints.updateDataset(dataset.id, { name: name.trim(), description: description.trim() })
      : endpoints.createDataset({ name: name.trim(), description: description.trim() || undefined })),
    onSuccess: (ds) => {
      qc.invalidateQueries({ queryKey: ["datasets"] });
      qc.invalidateQueries({ queryKey: ["datasets-all"] });
      qc.invalidateQueries({ queryKey: ["dataset", ds.id] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success(dataset ? "Dataset updated" : "Dataset created");
      onClose();
      if (!dataset) router.push(`/datasets/${ds.id}`);
    },
  });
  return (
    <Dialog open={open} onClose={onClose} title={dataset ? "Edit dataset" : "New dataset"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name.trim()}>{dataset ? "Save" : "Create"}</Button></>}>
      <div className="space-y-4">
        <Field label="Name" required>{(id) => <Input id={id} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} rows={3} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />}</Field>
        <InlineError error={save.error} />
      </div>
    </Dialog>
  );
}

export function DatasetsView() {
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const list = usePagedQuery("datasets", endpoints.datasets, { status: status || undefined });

  const columns: Column<Dataset>[] = [
    {
      key: "name", header: "Dataset", cell: (d) => (
        <div className="min-w-[14rem]">
          <Link href={`/datasets/${d.id}`} className="font-medium text-slate-900 hover:text-brand-700">{d.name}</Link>
          {d.description && <p className="max-w-md truncate text-xs text-slate-500">{d.description}</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status} /> },
    { key: "access", header: "Your access", cell: (d) => (d.my_access_level ? <Badge tone="indigo">{humanize(d.my_access_level)}</Badge> : "—") },
    { key: "uploads", header: "Uploads", className: "tabular-nums", cell: (d) => formatNumber(d.upload_count) },
    { key: "by", header: "Created by", cell: (d) => <UserName id={d.created_by} /> },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (d) => formatDate(d.created_at) },
  ];

  return (
    <RequirePerm allowed={can(Perm.DATASET_READ)}>
      <PageHeader title="Datasets" description="Logical collections of uploads with their own access control."
        actions={can(Perm.DATASET_CREATE) && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New dataset</Button>} />
      <Card>
        <TableToolbar>
          <FilterField label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any</option><option value="active">Active</option><option value="archived">Archived</option>
              </Select>
            )}
          </FilterField>
        </TableToolbar>
        <DataTable caption="Datasets" columns={columns} rows={list.items} rowKey={(d) => d.id} isLoading={list.isLoading}
          isFetching={list.isFetching} error={list.error} onRetry={() => list.refetch()}
          empty={<EmptyState icon={<Database className="h-6 w-6" />} title="No datasets" description="You don't have access to any datasets yet." />} />
        <Pagination pager={list.pager} nextCursor={list.nextCursor} count={list.items?.length} isFetching={list.isFetching} />
      </Card>
      {creating && <DatasetFormDialog open onClose={() => setCreating(false)} />}
    </RequirePerm>
  );
}
