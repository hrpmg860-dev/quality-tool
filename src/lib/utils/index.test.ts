import { describe, expect, it } from "vitest";
import { buildComparison } from "@/features/review/compare";
import { dateInputToIso, humanize, recordDisplayName, scoreValue } from "./index";

describe("scoreValue", () => {
  it("parses decimal strings and clamps to 0-100", () => {
    expect(scoreValue("91.25")).toBeCloseTo(91.25);
    expect(scoreValue(120)).toBe(100);
    expect(scoreValue("oops")).toBe(0);
    expect(scoreValue(null)).toBe(0);
  });
});

describe("humanize", () => {
  it("turns enum-style strings into labels", () => {
    expect(humanize("in_review")).toBe("In review");
    expect(humanize("record.read")).toBe("Record read");
    expect(humanize("")).toBe("—");
  });
});

describe("dateInputToIso", () => {
  it("converts dates and makes 'to' bounds exclusive", () => {
    const from = dateInputToIso("2025-01-15");
    const to = dateInputToIso("2025-01-15", true);
    expect(new Date(from!).getDate()).toBe(15);
    expect(new Date(to!).getDate()).toBe(16);
    expect(dateInputToIso("")).toBeUndefined();
  });
});

describe("recordDisplayName", () => {
  it("picks name-ish raw columns, falls back to normalized then id", () => {
    expect(recordDisplayName({ id: 5, raw_data: { "First Name": "Al", "Last Name": "Nak" } })).toBe("Al Nak");
    expect(recordDisplayName({ id: 5, raw_data: {}, normalized: { full_name_norm: "al nak" } })).toBe("al nak");
    expect(recordDisplayName({ id: 5, raw_data: {} })).toBe("Record #5");
    expect(recordDisplayName({ id: 5, redacted: true, raw_data: { name: "x" } })).toBe("Record #5 (restricted)");
  });
});

describe("buildComparison redaction safety", () => {
  it("redacted records (no raw_data from the API) contribute no raw columns", () => {
    const rows = buildComparison([
      { id: 1, redacted: true, raw_data: null } as never,
      { id: 2, redacted: false, raw_data: { email: "a@x.com" } } as never,
    ]);
    const rawRows = rows.filter((r) => r.section === "raw");
    expect(rawRows.map((r) => r.values)).toEqual([[null, "a@x.com"]]);
  });
});
