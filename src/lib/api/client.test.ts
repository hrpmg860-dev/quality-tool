import { describe, expect, it } from "vitest";
import { ApiError, buildQuery, toProblem } from "./client";

describe("buildQuery", () => {
  it("serializes values, skipping null/undefined/empty", () => {
    expect(buildQuery({ a: 1, b: "x y", c: undefined, d: null, e: "", f: false })).toBe("?a=1&b=x+y&f=false");
  });
  it("returns empty string for no params", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({ a: undefined })).toBe("");
  });
});

describe("toProblem", () => {
  it("passes through RFC 7807 bodies", () => {
    const p = toProblem(409, { title: "Conflict", detail: "version mismatch", code: "conflict" });
    expect(p).toMatchObject({ status: 409, title: "Conflict", detail: "version mismatch", code: "conflict" });
  });
  it("flattens FastAPI 422 detail arrays", () => {
    const p = toProblem(422, { detail: [{ loc: ["body", "email"], msg: "value is not a valid email" }] });
    expect(p.title).toBe("Validation error");
    expect(p.detail).toBe("email: value is not a valid email");
  });
  it("handles string detail and empty bodies", () => {
    expect(toProblem(403, { detail: "nope" }).detail).toBe("nope");
    expect(toProblem(500, null).title).toBe("Server error");
  });
});

describe("ApiError", () => {
  it("derives message from detail then title", () => {
    expect(new ApiError({ title: "T", detail: "d", status: 400 }).message).toBe("d");
    expect(new ApiError({ title: "T", status: 400 }).message).toBe("T");
  });
});
