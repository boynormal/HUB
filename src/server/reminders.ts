import type { ReminderKind } from "@prisma/client";

export type PlannedReminder = {
  kind: ReminderKind;
  offsetMin: number;
  runAt: Date;
};

const HOUR = 60;

/// Reminder plan from plan.md section 11:
/// T-24h reminds the employee, T-2h reminds again, the deadline notifies the department manager,
/// and one hour past the deadline notifies the Communication Admin.
/// Slots already in the past are dropped so publishing late never backfills reminders.
export function planReminders(
  deadline: Date | null | undefined,
  publishedAt: Date = new Date(),
): PlannedReminder[] {
  if (!deadline) return [];
  const deadlineMs = deadline.getTime();
  if (Number.isNaN(deadlineMs)) return [];

  const slots: Array<{ kind: ReminderKind; offsetMin: number }> = [
    { kind: "BEFORE_DEADLINE", offsetMin: -24 * HOUR },
    { kind: "READ_NOT_ACK", offsetMin: -2 * HOUR },
    { kind: "MANAGER_AT_DEADLINE", offsetMin: 0 },
    { kind: "ADMIN_OVERDUE", offsetMin: 1 * HOUR },
  ];

  return slots
    .map((slot) => ({
      kind: slot.kind,
      offsetMin: slot.offsetMin,
      runAt: new Date(deadlineMs + slot.offsetMin * 60_000),
    }))
    .filter((slot) => slot.runAt.getTime() > publishedAt.getTime());
}

export type ReceiptState = {
  readAt: Date | null;
  acknowledgedAt: Date | null;
};

export type ReceiptStatus = "UNREAD" | "READ" | "ACKNOWLEDGED" | "OVERDUE";

/// Read and acknowledged are separate states. Read never counts as acknowledged.
export function receiptStatus(
  receipt: ReceiptState | null | undefined,
  options: { requiresConfirmation: boolean; deadline?: Date | null; now?: Date },
): ReceiptStatus {
  const now = options.now ?? new Date();
  if (receipt?.acknowledgedAt) return "ACKNOWLEDGED";

  const pastDeadline =
    options.requiresConfirmation &&
    options.deadline instanceof Date &&
    options.deadline.getTime() < now.getTime();
  if (pastDeadline) return "OVERDUE";

  if (receipt?.readAt) return "READ";
  return "UNREAD";
}
