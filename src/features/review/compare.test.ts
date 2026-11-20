import { describe, expect, it } from "vitest";
import type { Match, RecordItem } from "@/types/api";
import { buildComparison, describeEvidence, groupConfidence, orderRecords } from "./compare";

const rec = (id: number, raw: Record<string, string>, norm: Record<string, string | null> = {}): RecordItem => ({
  id, dataset_id: 1, current_master_id: null, redacted: false, raw_data: raw,
  normalized: { normalization_version: "v1", first_name_norm: null, last_name_norm: null, full_name_norm: null, email_norm: null, email_domain: null, linkedin_slug: null, quality_flags: {}, ...norm },
});

const match = (a: number, b: number, score: string): Match => ({
  id: a * 100 + b, group_id: 1, record_a_id: a, record_b_id: b, score, tier: "high",
  scope: "intra_file", status: "pending", evidence: {}, created_at: "2025-01-01T00:00:00Z",
});

describe("buildComparison", () => {
  const records = [
    rec(1, { Email: "a@x.com", Name: "Al" }, { email_norm: "a@x.com" }),
    rec(2, { Email: "A@x.com ", Name: "Alan" }, { email_norm: "a@x.com" }),
  ];
  const rows = buildComparison(records);

  it("lists normalized fields first, then the union of raw columns", () => {
    expect(rows[0].key).toBe("n:full_name_norm");
    expect(rows.map((r) => r.label)).toContain("Email domain");
    expect(rows.filter((r) => r.section === "raw").map((r) => r.label)).toEqual(["Email", "Name"]);
  });

  it("marks agreeing and conflicting rows case/whitespace-insensitively", () => {
    const rawEmail = rows.find((r) => r.label === "Email" && r.section === "raw")!;
    expect(rawEmail.agree).toBe(true);
    expect(rawEmail.conflict).toBe(false);
    const rawName = rows.find((r) => r.label === "Name")!;
    expect(rawName.conflict).toBe(true);
    const normEmail = rows.find((r) => r.key === "n:email_norm")!;
    expect(normEmail.agree).toBe(true);
  });

  it("does not flag a row with values in only one record as agreeing or conflicting", () => {
    const single = buildComparison([rec(1, { A: "x" }), rec(2, {})]);
    const rowA = single.find((r) => r.label === "A")!;
    expect(rowA.values).toEqual(["x", null]);
    expect(rowA.agree).toBe(false);
    expect(rowA.conflict).toBe(false);
  });
});

describe("orderRecords", () => {
  it("puts the anchor first, then sorts by best match score", () => {
    const rs = [rec(3, {}), rec(1, {}), rec(2, {})];
    const ms = [match(1, 3, "80"), match(1, 2, "95")];
    expect(orderRecords(rs, ms, 1).map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("works without an anchor", () => {
    const rs = [rec(2, {}), rec(1, {})];
    expect(orderRecords(rs, [match(1, 2, "10")], null).map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("groupConfidence", () => {
  it("returns the max score, or null for no matches", () => {
    expect(groupConfidence([match(1, 2, "72.4"), match(1, 3, "91.2")])).toBeCloseTo(91.2);
    expect(groupConfidence([])).toBeNull();
  });
});

describe("describeEvidence", () => {
  it("translates flags, conflicts and numbers into chips", () => {
    const items = describeEvidence({ email_exact: true, name_similarity: 92.3, conflicts: ["linkedin_mismatch"] });
    expect(items).toContainEqual({ label: "email match", kind: "positive" });
    expect(items).toContainEqual({ label: "name similarity: 92.3", kind: "positive" });
    expect(items).toContainEqual({ label: "linkedin mismatch", kind: "negative" });
  });
});
