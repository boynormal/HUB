import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { deliverPhoneAlerts } from "@/server/phone-alerts";

export type NotificationDraft = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkPath?: string | null;
  postId?: string | null;
  commentId?: string | null;
  isUrgent?: boolean;
};

/// Writes in-app notifications in bulk. LINE delivery is a separate row created by the worker,
/// so a failed push never hides the in-app copy.
export async function createInAppNotifications(
  drafts: NotificationDraft[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  if (drafts.length === 0) return 0;
  const result = await client.communicationNotification.createMany({
    data: drafts.map((draft) => ({
      userId: draft.userId,
      type: draft.type,
      channel: "IN_APP" as const,
      title: draft.title,
      body: draft.body ?? null,
      linkPath: draft.linkPath ?? null,
      postId: draft.postId ?? null,
      commentId: draft.commentId ?? null,
      isUrgent: draft.isUrgent ?? false,
      sentAt: new Date(),
    })),
  });
  void deliverPhoneAlerts(drafts).catch((error) => console.error("phone alert failed", error));
  return result.count;
}

export async function createLineNotifications(drafts: NotificationDraft[]): Promise<string[]> {
  if (drafts.length === 0) return [];
  const created: string[] = [];
  for (const draft of drafts) {
    const row = await prisma.communicationNotification.create({
      data: {
        userId: draft.userId,
        type: draft.type,
        channel: "LINE",
        title: draft.title,
        body: draft.body ?? null,
        linkPath: draft.linkPath ?? null,
        postId: draft.postId ?? null,
        commentId: draft.commentId ?? null,
        isUrgent: draft.isUrgent ?? false,
      },
      select: { id: true },
    });
    created.push(row.id);
  }
  return created;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  return prisma.communicationNotification.count({
    where: { userId, channel: "IN_APP", readAt: null },
  });
}

export const PRIORITY_LABEL: Record<string, string> = {
  NORMAL: "ทั่วไป",
  INFO: "ข้อมูล",
  IMPORTANT: "สำคัญ",
  URGENT: "ด่วน",
  CRITICAL: "วิกฤต",
};

export const POST_TYPE_LABEL: Record<string, string> = {
  ANNOUNCEMENT: "ประกาศ",
  NEWS: "ข่าวสาร",
  ALERT: "แจ้งเตือน",
  PROCEDURE: "คู่มือ",
  TRAINING: "อบรม",
  EVENT: "กิจกรรม",
  QUESTION: "คำถาม",
  DOCUMENT: "เอกสาร",
  INSTRUCTION: "คำสั่งงาน",
  POLL: "แบบสอบถาม",
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  SCHEDULED: "ตั้งเวลา",
  PUBLISHED: "เผยแพร่แล้ว",
  EXPIRED: "หมดอายุ",
  ARCHIVED: "เก็บเข้าคลัง",
  CANCELLED: "ยกเลิก",
};
