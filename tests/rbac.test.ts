import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_KEYS,
  hasPermission,
  hasScopedPermission,
  isCommunicationAdmin,
  isSystemAdmin,
  type ActorContext,
  type GrantedPermission,
} from "@/server/rbac";

const BRANCH_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BRANCH_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const DEPARTMENT_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TOPIC_A = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const ME = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    userId: ME,
    employeeCode: "EMP001",
    fullName: "สมชาย ใจดี",
    nickname: null,
    avatarUrl: null,
    companyId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    branchId: BRANCH_A,
    departmentId: DEPARTMENT_A,
    positionId: null,
    branchName: "สำนักงานใหญ่",
    departmentName: "ฝ่ายบุคคล",
    positionName: null,
    roleKeys: [ROLE_KEYS.employee],
    permissions: [],
    managedDepartmentIds: [],
    managedTopicIds: [],
    ...overrides,
  };
}

function grant(
  key: string,
  scope: GrantedPermission["scope"],
  extra: Partial<GrantedPermission> = {},
): GrantedPermission {
  return { key, scope, branchId: null, departmentId: null, topicId: null, ...extra };
}

describe("hasPermission", () => {
  it("is false without a grant", () => {
    expect(hasPermission(actor(), PERMISSIONS.publish)).toBe(false);
  });

  it("is true with any grant for the key", () => {
    const withGrant = actor({ permissions: [grant(PERMISSIONS.publish, "TOPIC")] });
    expect(hasPermission(withGrant, PERMISSIONS.publish)).toBe(true);
  });
});

describe("hasScopedPermission", () => {
  it("passes every target for a company grant", () => {
    const admin = actor({ permissions: [grant(PERMISSIONS.edit, "COMPANY")] });
    expect(hasScopedPermission(admin, PERMISSIONS.edit, { branchId: BRANCH_B })).toBe(true);
  });

  it("limits a pinned branch grant to that branch", () => {
    const manager = actor({
      permissions: [grant(PERMISSIONS.edit, "BRANCH", { branchId: BRANCH_A })],
    });
    expect(hasScopedPermission(manager, PERMISSIONS.edit, { branchId: BRANCH_A })).toBe(true);
    expect(hasScopedPermission(manager, PERMISSIONS.edit, { branchId: BRANCH_B })).toBe(false);
  });

  it("falls back to the actor's own branch when the grant pins none", () => {
    const manager = actor({ permissions: [grant(PERMISSIONS.edit, "BRANCH")] });
    expect(hasScopedPermission(manager, PERMISSIONS.edit, { branchId: BRANCH_A })).toBe(true);
    expect(hasScopedPermission(manager, PERMISSIONS.edit, { branchId: BRANCH_B })).toBe(false);
  });

  it("uses the managed topic list for an unpinned topic grant", () => {
    const topicManager = actor({
      permissions: [grant(PERMISSIONS.publish, "TOPIC")],
      managedTopicIds: [TOPIC_A],
    });
    expect(hasScopedPermission(topicManager, PERMISSIONS.publish, { topicId: TOPIC_A })).toBe(true);
    expect(hasScopedPermission(topicManager, PERMISSIONS.publish, { topicId: BRANCH_B })).toBe(false);
  });

  it("restricts an own-scope grant to the actor's own records", () => {
    const author = actor({ permissions: [grant(PERMISSIONS.edit, "OWN")] });
    expect(hasScopedPermission(author, PERMISSIONS.edit, { ownerId: ME })).toBe(true);
    expect(hasScopedPermission(author, PERMISSIONS.edit, { ownerId: BRANCH_B })).toBe(false);
  });

  it("does not leak a grant across permission keys", () => {
    const author = actor({ permissions: [grant(PERMISSIONS.edit, "COMPANY")] });
    expect(hasScopedPermission(author, PERMISSIONS.delete, {})).toBe(false);
  });
});

describe("role helpers", () => {
  it("counts a system admin as a communication admin", () => {
    const sysAdmin = actor({ roleKeys: [ROLE_KEYS.systemAdmin] });
    expect(isCommunicationAdmin(sysAdmin)).toBe(true);
    expect(isSystemAdmin(sysAdmin)).toBe(true);
  });

  it("does not promote a communication admin to system admin", () => {
    const commAdmin = actor({ roleKeys: [ROLE_KEYS.communicationAdmin] });
    expect(isCommunicationAdmin(commAdmin)).toBe(true);
    expect(isSystemAdmin(commAdmin)).toBe(false);
  });
});
