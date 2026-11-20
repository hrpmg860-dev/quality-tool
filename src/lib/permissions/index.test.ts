import { describe, expect, it } from "vitest";
import type { Me, RoleInfo } from "@/types/api";
import { can, canAssignRole, datasetLevel, datasetsWithLevel, hasDatasetLevel, Perm, roleLabel } from "./index";

const me = (over: Partial<Me> = {}): Me => ({
  id: 1, email: "r@x.dev", display_name: "R", role: "reviewer", status: "active", auth_provider: "local",
  last_login_at: null, created_at: "", updated_at: "", is_admin: false, role_name: "Reviewer", teams: [],
  permissions: ["group.read", "review.decide", "review.approve"], dataset_access: { "7": "review", "9": "read" },
  ...over,
});

const role = (over: Partial<RoleInfo>): RoleInfo => ({
  role: "x", name: "X", description: null, is_system: false, is_admin: false, editable: true,
  permissions: [], user_count: null, ...over,
});

describe("can", () => {
  it("checks permission membership", () => {
    expect(can(me(), Perm.REVIEW_DECIDE)).toBe(true);
    expect(can(me(), Perm.REVIEW_APPROVE)).toBe(true);
    expect(can(me(), Perm.MERGE_REVERT)).toBe(false);
    expect(can(me(), Perm.USER_MANAGE)).toBe(false);
    expect(can(null, Perm.REVIEW_DECIDE)).toBe(false);
  });
});

describe("dataset levels", () => {
  it("enforces read < upload < review < manage", () => {
    const m = me();
    expect(datasetLevel(m, 7)).toBe("review");
    expect(hasDatasetLevel(m, 7, "review")).toBe(true);
    expect(hasDatasetLevel(m, 7, "manage")).toBe(false);
    expect(hasDatasetLevel(m, 9, "upload")).toBe(false);
    expect(hasDatasetLevel(m, 9, "read")).toBe(true);
    expect(hasDatasetLevel(m, 11, "read")).toBe(false);
  });
  it("admins implicitly manage every dataset", () => {
    expect(hasDatasetLevel(me({ is_admin: true }), 42, "manage")).toBe(true);
  });
});

describe("datasetsWithLevel", () => {
  it("filters to datasets the user can act on", () => {
    const ds = [{ id: 7 }, { id: 9 }, { id: 11 }];
    expect(datasetsWithLevel(me(), ds, "upload").map((d) => d.id)).toEqual([7]);
    expect(datasetsWithLevel(me({ is_admin: true }), ds, "manage")).toHaveLength(3);
  });
});

describe("roles", () => {
  it("labels system and custom roles", () => {
    expect(roleLabel("manager")).toBe("Manager");
    expect(roleLabel("triager", [role({ role: "triager", name: "Triager" })])).toBe("Triager");
    expect(roleLabel("unknown_role")).toBe("unknown_role");
  });
  it("never offers roles that would escalate privileges", () => {
    const admin = me({ role: "admin", is_admin: true, permissions: ["user.manage", "group.read", "review.decide"] });
    expect(canAssignRole(admin, role({ role: "super_admin", is_admin: true }))).toBe(false);
    expect(canAssignRole(admin, role({ permissions: ["group.read"] }))).toBe(true);
    expect(canAssignRole(admin, role({ permissions: ["role.manage"] }))).toBe(false);
    expect(canAssignRole(me({ permissions: ["user.manage"] }), role({ role: "admin", is_admin: true }))).toBe(false);
    expect(canAssignRole(me({ role: "super_admin" }), role({ role: "super_admin", is_admin: true }))).toBe(true);
  });
});
