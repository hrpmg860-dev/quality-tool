"use client";

import { History, Search } from "lucide-react";
import { useState } from "react";
import { FilterField, Input, Select } from "@/components/forms/fields";
import { PageHeader, RequirePerm } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { TableToolbar } from "@/components/tables/DataTable";
import { useDatasets } from "@/components/ui/entities";
import { EmptyState } from "@/components/ui/states";
import { RecordsTable } from "@/features/search/RecordsTable";
import { useDebounced } from "@/hooks/useDebounced";
import { usePagedQuery } from "@/hooks/usePagedQuery";
import { endpoints } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Perm } from "@/lib/permissions";

/**
 * Historical record search — searches the immutable record store across all
 * readable datasets. `q` hits normalized email, LinkedIn and fuzzy name
 * (pg_trgm) server-side; filters narrow further.
 */
export function SearchView() {
  const { can } = useAuth();
  const datasets = useDatasets();
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [name, setName] = useState("");
  const [dataset, setDataset] = useState("");
  const [masterId, setMasterId] = useState("");
  const dq = useDebounced(q), de = useDebounced(email), dl = useDebounced(linkedin), dn = useDebounced(name), dm = useDebounced(masterId);

  const list = usePagedQuery("records", endpoints.records, {
    q: dq, email: de, linkedin: dl, name: dn, dataset_id: dataset || undefined, master_id: dm || undefined,
  }, { enabled: can(Perm.RECORD_READ) });

  return (
    <RequirePerm allowed={can(Perm.RECORD_READ)}>
      <PageHeader
        title="Record search"
        description="Every row ever ingested — raw values are immutable and kept next to their normalized comparison form."
      />
      <Card>
        <TableToolbar>
          <FilterField label="Search everything" className="min-w-[16rem] flex-1">
            {(id) => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input id={id} className="pl-8" placeholder="Email, LinkedIn or name…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              </div>
            )}
          </FilterField>
          <FilterField label="Email exact">{(id) => <Input id={id} placeholder="person@org.com" value={email} onChange={(e) => setEmail(e.target.value)} />}</FilterField>
          <FilterField label="LinkedIn">{(id) => <Input id={id} placeholder="linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />}</FilterField>
          <FilterField label="Fuzzy name">{(id) => <Input id={id} placeholder="Alise Nakamura" value={name} onChange={(e) => setName(e.target.value)} />}</FilterField>
          <FilterField label="Dataset">
            {(id) => (
              <Select id={id} value={dataset} onChange={(e) => setDataset(e.target.value)}>
                <option value="">All datasets</option>
                {datasets.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
          </FilterField>
          <FilterField label="Master ID">
            {(id) => <Input id={id} inputMode="numeric" placeholder="e.g. 42" value={masterId} onChange={(e) => setMasterId(e.target.value.replace(/\D/g, ""))} />}
          </FilterField>
        </TableToolbar>
        <RecordsTable
          rows={list.items} isLoading={list.isLoading} isFetching={list.isFetching} error={list.error}
          onRetry={() => list.refetch()} pager={list.pager} nextCursor={list.nextCursor} showDataset showSimilarity
          empty={<EmptyState icon={<History className="h-6 w-6" />} title="No records found" description="Records appear after uploads are processed. Check your dataset access or adjust the filters." />}
        />
      </Card>
    </RequirePerm>
  );
}
