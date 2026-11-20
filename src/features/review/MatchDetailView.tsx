"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, KeyValues } from "@/components/ui/card";
import { ConfidenceScore } from "@/components/ui/progress";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { endpoints } from "@/lib/api/endpoints";
import { formatDateTime, humanize } from "@/lib/utils";
import { buildComparison, describeEvidence, orderRecords } from "./compare";

export function MatchDetailView({ id }: { id: number }) {
  const match = useQuery({ queryKey: ["match", id], queryFn: () => endpoints.match(id) });
  if (match.isLoading) return <LoadingBlock />;
  if (match.error || !match.data) return <Card><ErrorState error={match.error} onRetry={() => match.refetch()} /></Card>;
  const m = match.data;
  const records = [m.record_a, m.record_b].filter((r): r is NonNullable<typeof r> => r != null);
  const rows = buildComparison(orderRecords(records, [m], m.record_a?.id ?? null));

  return (
    <>
      <PageHeader
        breadcrumb={[{ href: `/review/${m.group_id}`, label: `Group #${m.group_id}` }, { href: `/review/matches/${m.id}`, label: `Match #${m.id}` }]}
        title={<span className="flex items-center gap-3">Match #{m.id} <StatusBadge status={m.status} /></span>}
        description={`${humanize(m.tier)} tier · ${humanize(m.scope)} scope · created ${formatDateTime(m.created_at)}`}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="h-fit">
          <CardHeader title="Match" />
          <CardBody>
            <ConfidenceScore score={m.score} />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {describeEvidence(m.evidence).map((e, i) => (
                <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${e.kind === "positive" ? "bg-emerald-50 text-emerald-700" : e.kind === "negative" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"}`}>{e.label}</span>
              ))}
            </div>
            <KeyValues className="mt-4 sm:grid-cols-1" items={[
              ["Record A", m.record_a_id ? <Link key="a" href={`/records/${m.record_a_id}`} className="text-brand-700">#{m.record_a_id}</Link> : "—"],
              ["Record B", m.record_b_id ? <Link key="b" href={`/records/${m.record_b_id}`} className="text-brand-700">#{m.record_b_id}</Link> : "—"],
              ["Group", <Link key="g" href={`/review/${m.group_id}`} className="text-brand-700">#{m.group_id}</Link>],
            ]} />
          </CardBody>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Record comparison" />
          <CardBody>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-slate-50">
                  <th className="w-44 px-3 py-2 text-left text-xs font-semibold text-slate-500">Field</th>
                  {records.map((r) => (
                    <th key={r.id} className="min-w-[14rem] px-3 py-2 text-left text-xs font-semibold text-slate-700">
                      <Link href={`/records/${r.id}`} className="text-brand-700">Record #{r.id}</Link>
                    </th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.key} className={row.section === "raw" ? "bg-slate-50/40" : ""}>
                      <th className="px-3 py-2 text-left align-top text-xs font-medium text-slate-500">{row.label}</th>
                      {row.values.map((v, i) => (
                        <td key={i} className={`px-3 py-2 align-top text-[13px] ${row.conflict ? "bg-red-50/60 text-red-900" : row.agree ? "bg-emerald-50/50 text-emerald-900" : ""}`}>
                          {v ?? <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
