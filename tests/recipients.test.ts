import { describe, expect, it } from "vitest";
import { buildRecipientWhere } from "@/server/recipients";

const BRANCH = "11111111-1111-1111-1111-111111111111";
const DEPARTMENT = "22222222-2222-2222-2222-222222222222";
const USER = "33333333-3333-3333-3333-333333333333";

describe("buildRecipientWhere", () => {
  it("returns nothing when there are no rules", () => {
    expect(buildRecipientWhere([])).toBeNull();
  });

  it("matches every active employee for the ALL rule and ignores the rest", () => {
    const where = buildRecipientWhere([
      { targetType: "ALL", targetId: null },
      { targetType: "BRANCH", targetId: BRANCH },
    ]);
    expect(where).toEqual({ status: "ACTIVE" });
  });

  it("combines rules additively", () => {
    const where = buildRecipientWhere([
      { targetType: "BRANCH", targetId: BRANCH },
      { targetType: "DEPARTMENT", targetId: DEPARTMENT },
      { targetType: "USER", targetId: USER },
    ]);
    expect(where).toEqual({
      status: "ACTIVE",
      OR: [
        { branchId: { in: [BRANCH] } },
        { departmentId: { in: [DEPARTMENT] } },
        { id: { in: [USER] } },
      ],
    });
  });

  it("always limits recipients to active employees", () => {
    const where = buildRecipientWhere([{ targetType: "BRANCH", targetId: BRANCH }]);
    expect(where?.status).toBe("ACTIVE");
  });

  it("skips rules that carry no target id", () => {
    expect(buildRecipientWhere([{ targetType: "BRANCH", targetId: null }])).toBeNull();
  });
});
