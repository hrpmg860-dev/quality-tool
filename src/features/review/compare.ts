import type { Match, Normalized, RecordItem } from "@/types/api";
import { scoreValue } from "@/lib/utils";

export interface CompareRow {
  key: string;
  label: string;
  section: "normalized" | "raw";
  values: (string | null)[];
  /** all non-empty values equal (case/whitespace-insensitive) */
  agree: boolean;
  /** at least two non-empty values differ */
  conflict: boolean;
}

const NORMALIZED_FIELDS: [keyof Normalized, string][] = [
  ["full_name_norm", "Full name"],
  ["first_name_norm", "First name"],
  ["last_name_norm", "Last name"],
  ["email_norm", "Email"],
  ["email_domain", "Email domain"],
  ["linkedin_slug", "LinkedIn"],
];

const canon = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

function row(key: string, label: string, section: CompareRow["section"], values: (string | null)[]): CompareRow {
  const present = values.map(canon).filter(Boolean);
  const distinct = new Set(present);
  return { key, label, section, values, agree: present.length > 1 && distinct.size === 1, conflict: distinct.size > 1 };
}

/** Builds the side-by-side grid: normalized comparison values first, then
 * every raw source column (union across records, first-seen order). */
export function buildComparison(records: RecordItem[]): CompareRow[] {
  const rows: CompareRow[] = NORMALIZED_FIELDS.map(([f, label]) =>
    row(`n:${f}`, label, "normalized", records.map((r) => (r.normalized?.[f] as string | null | undefined) ?? null)),
  );
  const rawKeys: string[] = [];
  for (const r of records) for (const k of Object.keys(r.raw_data ?? {})) if (!rawKeys.includes(k)) rawKeys.push(k);
  for (const k of rawKeys) rows.push(row(`r:${k}`, k, "raw", records.map((r) => r.raw_data?.[k] ?? null)));
  return rows;
}

/** Orders records anchor-first, then by best match score to the anchor. */
export function orderRecords(records: RecordItem[], matches: Match[], anchorId: number | null): RecordItem[] {
  const best = new Map<number, number>();
  for (const m of matches) {
    const s = scoreValue(m.score);
    for (const id of [m.record_a_id, m.record_b_id]) best.set(id, Math.max(best.get(id) ?? 0, s));
  }
  return [...records].sort((a, b) => {
    if (a.id === anchorId) return -1;
    if (b.id === anchorId) return 1;
    return (best.get(b.id) ?? 0) - (best.get(a.id) ?? 0) || a.id - b.id;
  });
}

export function groupConfidence(matches: Match[]): number | null {
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => scoreValue(m.score)));
}

export interface EvidenceItem {
  label: string;
  kind: "positive" | "negative" | "neutral";
}

/** Turns the matcher's evidence JSON into readable chips. */
export function describeEvidence(evidence: Record<string, unknown>): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (const [k, v] of Object.entries(evidence ?? {})) {
    if (k === "conflicts" && Array.isArray(v)) {
      for (const c of v) out.push({ label: String(c).replace(/_/g, " "), kind: "negative" });
    } else if (typeof v === "boolean") {
      out.push({ label: k.replace(/_/g, " ").replace(/ exact$/, " match"), kind: v ? "positive" : "neutral" });
    } else if (typeof v === "number") {
      out.push({ label: `${k.replace(/_/g, " ")}: ${Number.isInteger(v) ? v : v.toFixed(1)}`, kind: v >= 85 ? "positive" : "neutral" });
    } else if (v != null && typeof v !== "object") {
      out.push({ label: `${k.replace(/_/g, " ")}: ${String(v)}`, kind: "neutral" });
    }
  }
  return out;
}
