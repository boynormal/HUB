import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { createInAppNotifications, createLineNotifications } from "@/server/notifications";
import { fanOutPostNotifications } from "@/server/posts";
import { deadlineLabel, formatThaiDateTime } from "@/server/time";
import { pendingRecipients } from "@/server/reports";
import { resolveRecipientIds, syncReceipts } from "@/server/recipients";
import { planReminders } from "@/server/reminders";

/// Reminds everyone who has not acknowledged yet. Used by the reminder ladder and by the
/// "เตือนอีกครั้ง" button on the post page.
export async function remindPending(postId: string): Promise<number> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      title: true,
      confirmationDeadline: true,
      priority: true,
      topic: { select: { name: true } },
    },
  });
  if (!post) return 0;

  const pending = await pendingRecipients(postId);
  if (pending.length === 0) return 0;

  const body = post.confirmationDeadline
    ? deadlineLabel(post.confirmationDeadline)
    : "กรุณากดรับทราบ";
  const drafts = pending.map((receipt) => ({
    userId: receipt.user.id,
    type: "CONFIRMATION_REMINDER" as const,
    title: `ยังไม่ได้รับทราบ: ${post.title}`,
    body,
    linkPath: `/posts/${post.id}`,
    postId: post.id,
    isUrgent: true,
  }));

  await createInAppNotifications(drafts);
  const lineDrafts = drafts.filter((draft) =>
    pending.some((receipt) => receipt.user.id === draft.userId && receipt.user.lineUserId),
  );
  await createLineNotifications(lineDrafts);

  await recordAudit({
    userId: null,
    action: AUDIT.reminderSent,
    entity: "post",
    entityId: post.id,
    metadata: { kind: "pending", count: drafts.length },
  });
  return drafts.length;
}

/// Reminds only the people who read the post but never acknowledged it. Close to the deadline
/// this is the group worth nudging: they saw it and still owe an answer.
export async function remindReadNotAcknowledged(postId: string): Promise<number> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, title: true, confirmationDeadline: true },
  });
  if (!post) return 0;

  const receipts = await prisma.communicationPostReceipt.findMany({
    where: { postId, acknowledgedAt: null, readAt: { not: null } },
    select: { user: { select: { id: true, lineUserId: true } } },
  });
  if (receipts.length === 0) return 0;

  const drafts = receipts.map((receipt) => ({
    userId: receipt.user.id,
    type: "CONFIRMATION_REMINDER" as const,
    title: `เหลือเวลาอีกไม่นาน: ${post.title}`,
    body: post.confirmationDeadline ? deadlineLabel(post.confirmationDeadline) : "กรุณากดรับทราบ",
    linkPath: `/posts/${post.id}`,
    postId: post.id,
    isUrgent: true,
  }));
  await createInAppNotifications(drafts);
  await createLineNotifications(
    drafts.filter((draft) =>
      receipts.some((receipt) => receipt.user.id === draft.userId && receipt.user.lineUserId),
    ),
  );
  return drafts.length;
}

/// At the deadline the manager of each affected department gets one summary, not one message per
/// employee. A department with no manager escalates to the Communication Admin instead.
export async function notifyDepartmentManagers(postId: string): Promise<number> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, title: true, confirmationDeadline: true },
  });
  if (!post) return 0;

  const pending = await pendingRecipients(postId);
  if (pending.length === 0) return 0;

  const byManager = new Map<string, { names: string[]; departmentName: string }>();
  const orphans: string[] = [];

  for (const receipt of pending) {
    const managerId = receipt.user.department?.managerUserId ?? null;
    const label = `${receipt.user.fullName} (${receipt.user.employeeCode})`;
    if (!managerId || managerId === receipt.user.id) {
      orphans.push(label);
      continue;
    }
    const bucket = byManager.get(managerId) ?? {
      names: [],
      departmentName: receipt.user.department?.name ?? "ไม่ระบุแผนก",
    };
    bucket.names.push(label);
    byManager.set(managerId, bucket);
  }

  let sent = 0;
  for (const [managerId, bucket] of byManager) {
    const list = bucket.names.slice(0, 10).join(", ");
    const more = bucket.names.length > 10 ? ` และอีก ${bucket.names.length - 10} คน` : "";
    await createInAppNotifications([
      {
        userId: managerId,
        type: "MANAGER_SUMMARY",
        title: `${bucket.departmentName}: ยังไม่รับทราบ ${bucket.names.length} คน`,
        body: `${post.title} — ${list}${more}`,
        linkPath: `/posts/${post.id}/receipts`,
        postId: post.id,
        isUrgent: true,
      },
    ]);
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: { lineUserId: true },
    });
    if (manager?.lineUserId) {
      await createLineNotifications([
        {
          userId: managerId,
          type: "MANAGER_SUMMARY",
          title: `${bucket.departmentName}: ยังไม่รับทราบ ${bucket.names.length} คน`,
          body: post.title,
          linkPath: `/posts/${post.id}/receipts`,
          postId: post.id,
          isUrgent: true,
        },
      ]);
    }
    sent += 1;
  }

  if (orphans.length > 0) {
    sent += await notifyCommunicationAdmins(post, orphans, "ไม่มีผู้จัดการแผนก");
  }

  await recordAudit({
    userId: null,
    action: AUDIT.reminderSent,
    entity: "post",
    entityId: post.id,
    metadata: { kind: "manager_summary", managers: byManager.size, orphans: orphans.length },
  });
  return sent;
}

/// One hour past the deadline the Communication Admin sees what is still outstanding.
export async function notifyAdminsOverdue(postId: string): Promise<number> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, title: true, confirmationDeadline: true },
  });
  if (!post) return 0;
  const pending = await pendingRecipients(postId);
  if (pending.length === 0) return 0;
  return notifyCommunicationAdmins(
    post,
    pending.map((receipt) => `${receipt.user.fullName} (${receipt.user.employeeCode})`),
    "เกินกำหนดรับทราบ",
  );
}

async function notifyCommunicationAdmins(
  post: { id: string; title: string; confirmationDeadline: Date | null },
  names: string[],
  reason: string,
): Promise<number> {
  const admins = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { key: { in: ["communication_admin", "system_admin"] } } } },
    },
    select: { id: true },
  });
  if (admins.length === 0) return 0;

  const list = names.slice(0, 15).join(", ");
  const more = names.length > 15 ? ` และอีก ${names.length - 15} คน` : "";
  await createInAppNotifications(
    admins.map((admin) => ({
      userId: admin.id,
      type: "OVERDUE" as const,
      title: `${reason}: ${post.title} (${names.length} คน)`,
      body: post.confirmationDeadline
        ? `กำหนด ${formatThaiDateTime(post.confirmationDeadline)} — ${list}${more}`
        : `${list}${more}`,
      linkPath: `/posts/${post.id}/receipts`,
      postId: post.id,
      isUrgent: true,
    })),
  );
  return admins.length;
}

/// Runs one planned reminder row. Marked sent afterwards so a restart never repeats it.
export async function runReminder(reminderId: string): Promise<void> {
  const reminder = await prisma.communicationPostReminder.findUnique({
    where: { id: reminderId },
    select: { id: true, postId: true, kind: true, sentAt: true },
  });
  if (!reminder || reminder.sentAt) return;

  switch (reminder.kind) {
    case "BEFORE_DEADLINE":
    case "UNREAD":
      await remindPending(reminder.postId);
      break;
    case "READ_NOT_ACK":
      await remindReadNotAcknowledged(reminder.postId);
      break;
    case "MANAGER_AT_DEADLINE":
      await notifyDepartmentManagers(reminder.postId);
      break;
    case "ADMIN_OVERDUE":
      await notifyAdminsOverdue(reminder.postId);
      break;
    default:
      break;
  }

  await prisma.communicationPostReminder.update({
    where: { id: reminder.id },
    data: { sentAt: new Date() },
  });
}

export async function dueReminderIds(now = new Date()): Promise<string[]> {
  const rows = await prisma.communicationPostReminder.findMany({
    where: { sentAt: null, runAt: { lte: now }, post: { deletedAt: null, status: "PUBLISHED" } },
    select: { id: true },
    take: 200,
  });
  return rows.map((row) => row.id);
}

/// Publishes posts whose scheduled time has arrived.
export async function publishDueScheduledPosts(now = new Date()): Promise<string[]> {
  const due = await prisma.communicationPost.findMany({
    where: { status: "SCHEDULED", deletedAt: null, scheduledAt: { lte: now } },
    select: { id: true },
    take: 50,
  });

  const published: string[] = [];
  for (const post of due) {
    const record = await prisma.communicationPost.findUnique({
      where: { id: post.id },
      include: { targets: true },
    });
    if (!record || record.targets.length === 0) continue;

    const recipientIds = await resolveRecipientIds(record.targets);
    await syncReceipts(record.id, recipientIds);
    const reminders = record.requiresConfirmation
      ? planReminders(record.confirmationDeadline, now)
      : [];

    await prisma.$transaction(async (tx) => {
      await tx.communicationPost.update({
        where: { id: record.id },
        data: { status: "PUBLISHED", publishedAt: now, scheduledAt: null },
      });
      if (reminders.length > 0) {
        await tx.communicationPostReminder.createMany({
          data: reminders.map((reminder) => ({
            postId: record.id,
            kind: reminder.kind,
            offsetMin: reminder.offsetMin,
            runAt: reminder.runAt,
          })),
        });
      }
    });

    await recordAudit({
      userId: null,
      action: AUDIT.postPublished,
      entity: "post",
      entityId: record.id,
      metadata: { scheduled: true, recipientCount: recipientIds.length },
    });
    await fanOutPostNotifications(record.id);
    published.push(record.id);
  }
  return published;
}

/// Moves posts past their expiry date out of the active feed.
export async function expirePosts(now = new Date()): Promise<number> {
  const result = await prisma.communicationPost.updateMany({
    where: { status: "PUBLISHED", deletedAt: null, expiresAt: { lte: now } },
    data: { status: "EXPIRED", isPinned: false },
  });
  return result.count;
}
