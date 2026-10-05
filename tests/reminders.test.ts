import { describe, expect, it } from "vitest";
import { planReminders, receiptStatus } from "@/server/reminders";

const deadline = new Date("2026-10-10T09:00:00.000Z");

describe("planReminders", () => {
  it("plans the four steps from the reminder ladder", () => {
    const plan = planReminders(deadline, new Date("2026-10-01T00:00:00.000Z"));
    expect(plan.map((slot) => slot.kind)).toEqual([
      "BEFORE_DEADLINE",
      "READ_NOT_ACK",
      "MANAGER_AT_DEADLINE",
      "ADMIN_OVERDUE",
    ]);
    expect(plan[0].runAt.toISOString()).toBe("2026-10-09T09:00:00.000Z");
    expect(plan[1].runAt.toISOString()).toBe("2026-10-10T07:00:00.000Z");
    expect(plan[2].runAt.toISOString()).toBe(deadline.toISOString());
    expect(plan[3].runAt.toISOString()).toBe("2026-10-10T10:00:00.000Z");
  });

  it("drops slots that are already past at publish time", () => {
    const plan = planReminders(deadline, new Date("2026-10-10T08:00:00.000Z"));
    expect(plan.map((slot) => slot.kind)).toEqual(["MANAGER_AT_DEADLINE", "ADMIN_OVERDUE"]);
  });

  it("plans nothing without a deadline", () => {
    expect(planReminders(null)).toEqual([]);
    expect(planReminders(undefined)).toEqual([]);
  });
});

describe("receiptStatus", () => {
  const before = new Date("2026-10-09T00:00:00.000Z");
  const after = new Date("2026-10-11T00:00:00.000Z");

  it("treats a missing receipt as unread", () => {
    expect(receiptStatus(null, { requiresConfirmation: true, deadline, now: before })).toBe("UNREAD");
  });

  it("keeps read separate from acknowledged", () => {
    const status = receiptStatus(
      { readAt: new Date("2026-10-08T00:00:00.000Z"), acknowledgedAt: null },
      { requiresConfirmation: true, deadline, now: before },
    );
    expect(status).toBe("READ");
  });

  it("reports overdue once the deadline passes without an acknowledgement", () => {
    const status = receiptStatus(
      { readAt: new Date("2026-10-08T00:00:00.000Z"), acknowledgedAt: null },
      { requiresConfirmation: true, deadline, now: after },
    );
    expect(status).toBe("OVERDUE");
  });

  it("stays acknowledged even after the deadline", () => {
    const status = receiptStatus(
      { readAt: before, acknowledgedAt: before },
      { requiresConfirmation: true, deadline, now: after },
    );
    expect(status).toBe("ACKNOWLEDGED");
  });

  it("never reports overdue when confirmation is not required", () => {
    const status = receiptStatus(
      { readAt: null, acknowledgedAt: null },
      { requiresConfirmation: false, deadline, now: after },
    );
    expect(status).toBe("UNREAD");
  });
});
