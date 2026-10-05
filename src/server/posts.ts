import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import {
  PERMISSIONS,
  hasScopedPermission,
  isCommunicationAdmin,
  type ActorContext,
} from "@/server/rbac";
import { isRecipient, resolveRecipientIds, syncReceipts, type TargetRule } from "@/server/recipients";
import { planReminders, type ReceiptStatus } from "@/server/reminders";
import { createInAppNotifications, createLineNotifications } from "@/server/notifications";
import { toPlainText } from "@/server/sanitize";
import { env } from "@/server/env";
import { getPublisher, QUEUES } from "@/server/queue";
import { parseMentions } from "@/server/mentions";

export const VISIBLE_STATUSES = ["PUBLISHED", "EXPIRED"] as const;

export type FeedSection = "action" | "important" | "latest";

export type FeedFilters = {
  topicSlug?: string | null;
  tagSlug?: string | null;
  priority?: string | null;
  query?: string | null;
  needsAcknowledgement?: boolean;
  unreadOnly?: boolean;
};

export type FeedCard = {
  id: string;
  title: string;
  summary: string;
  topicName: string;
  topicSlug: string;
  topicColor: string | null;
  postType: string;
  priority: string;
  isPinned: boolean;
  publishedAt: Date | null;
  requiresConfirmation: boolean;
  confirmationDeadline: Date | null;
  coverImagePath: string | null;
  authorName: string;
  tags: Array<{ name: string; slug: string }>;
  commentCount: number;
  attachmentCount: number;
  images: Array<{ id: string; fileName: string; kind: "image" | "video" }>;
  readCount: number;
  acknowledgedCount: number;
  recipientCount: number;
  viewerStatus: ReceiptStatus;
};

/// A post an employee may open: they hold a receipt, or they manage the content.
export async function canViewPost(actor: ActorContext, postId: string): Promise<boolean> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId },
    select: {
      id: true,
      status: true,
      deletedAt: true,
      topicId: true,
      authorId: true,
      targets: { select: { targetType: true, targetId: true } },
    },
  });
  if (!post) return false;
  if (post.deletedAt) return isCommunicationAdmin(actor);
  if (canManagePostRecord(actor, post)) return true;
  if (!VISIBLE_STATUSES.includes(post.status as (typeof VISIBLE_STATUSES)[number])) return false;

  const receipt = await prisma.communicationPostReceipt.findUnique({
    where: { postId_userId: { postId, userId: actor.userId } },
    select: { id: true },
  });
  if (receipt) return true;
  return isRecipient(post.targets, actor.userId);
}

type ManageableRecord = { topicId: string; authorId: string };

export function canManagePostRecord(actor: ActorContext, post: ManageableRecord): boolean {
  if (isCommunicationAdmin(actor)) return true;
  return hasScopedPermission(actor, PERMISSIONS.edit, {
    topicId: post.topicId,
    ownerId: post.authorId,
  });
}

export async function requireManagePost(actor: ActorContext, postId: string) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: { targets: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์แก้ประกาศนี้");
  return post;
}

/// Records a view. Read is stored once; later views only bump the counters.
export async function markRead(actor: ActorContext, postId: string, ip: string | null): Promise<Date> {
  const now = new Date();
  const existing = await prisma.communicationPostReceipt.findUnique({
    where: { postId_userId: { postId, userId: actor.userId } },
  });

  if (!existing) {
    // Managers and admins can open a post they are not a recipient of. No receipt is created
    // for them, so reports never count staff who were not targeted.
    const targeted = await prisma.communicationPost.findFirst({
      where: { id: postId },
      select: { targets: { select: { targetType: true, targetId: true } } },
    });
    if (!targeted || !(await isRecipient(targeted.targets, actor.userId))) return now;
    await prisma.communicationPostReceipt.create({
      data: { postId, userId: actor.userId, readAt: now, lastViewedAt: now, viewCount: 1 },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.postRead,
      entity: "post",
      entityId: postId,
      ipAddress: ip,
    });
    return now;
  }

  const firstRead = existing.readAt === null;
  await prisma.communicationPostReceipt.update({
    where: { id: existing.id },
    data: {
      readAt: existing.readAt ?? now,
      lastViewedAt: now,
      viewCount: { increment: 1 },
    },
  });
  if (firstRead) {
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.postRead,
      entity: "post",
      entityId: postId,
      ipAddress: ip,
    });
  }
  return existing.readAt ?? now;
}

/// Explicit acknowledgement. Only the signed-in employee can acknowledge their own receipt.
export async function acknowledgePost(
  actor: ActorContext,
  postId: string,
  note: string | null,
  ip: string | null,
): Promise<Date> {
  const receipt = await prisma.communicationPostReceipt.findUnique({
    where: { postId_userId: { postId, userId: actor.userId } },
  });
  if (!receipt) throw new HttpError(403, "ประกาศนี้ไม่ได้ส่งถึงคุณ");
  if (receipt.acknowledgedAt) return receipt.acknowledgedAt;

  const now = new Date();
  await prisma.communicationPostReceipt.update({
    where: { id: receipt.id },
    data: {
      readAt: receipt.readAt ?? now,
      acknowledgedAt: now,
      acknowledgeNote: note?.trim() ? note.trim().slice(0, 500) : null,
      lastViewedAt: now,
    },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postAcknowledged,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: note?.trim() ? { note: note.trim().slice(0, 500) } : undefined,
  });
  return now;
}

export type PublishResult = {
  recipientCount: number;
  newReceipts: number;
  remindersPlanned: number;
};

/// Publishes a post: resolves the target rules into receipts, plans reminders and queues
/// notification work. Mass delivery happens in the worker, never inside this request.
export async function publishPost(
  actor: ActorContext,
  postId: string,
  ip: string | null,
): Promise<PublishResult> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: { targets: true, topic: { select: { name: true } } },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (
    !isCommunicationAdmin(actor) &&
    !hasScopedPermission(actor, PERMISSIONS.publish, {
      topicId: post.topicId,
      ownerId: post.authorId,
    })
  ) {
    throw new HttpError(403, "ไม่มีสิทธิ์เผยแพร่ประกาศนี้");
  }
  if (post.targets.length === 0) throw new HttpError(400, "ต้องเลือกผู้รับก่อนเผยแพร่");
  if (post.status === "PUBLISHED") throw new HttpError(400, "ประกาศนี้เผยแพร่แล้ว");

  const now = new Date();
  const recipientIds = await resolveRecipientIds(post.targets as TargetRule[]);
  const newReceipts = await syncReceipts(post.id, recipientIds);
  const reminders = post.requiresConfirmation
    ? planReminders(post.confirmationDeadline, now)
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.communicationPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        publishedAt: post.publishedAt ?? now,
        publishedBy: actor.userId,
        scheduledAt: null,
      },
    });
    if (reminders.length > 0) {
      await tx.communicationPostReminder.createMany({
        data: reminders.map((reminder) => ({
          postId: post.id,
          kind: reminder.kind,
          offsetMin: reminder.offsetMin,
          runAt: reminder.runAt,
        })),
      });
    }
  });

  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postPublished,
    entity: "post",
    entityId: post.id,
    ipAddress: ip,
    metadata: { recipientCount: recipientIds.length, newReceipts },
  });

  await enqueuePostPublished(post.id);

  return {
    recipientCount: recipientIds.length,
    newReceipts,
    remindersPlanned: reminders.length,
  };
}

async function enqueuePostPublished(postId: string): Promise<void> {
  const boss = await getPublisher(env().DATABASE_URL);
  if (boss) {
    try {
      // The worker normally creates queues. Publishing still has to succeed before the worker
      // has been started, so the queue is created here when it is missing.
      await boss.createQueue(QUEUES.postPublished);
      await boss.send(QUEUES.postPublished, { postId });
      return;
    } catch (error) {
      console.error("[queue] send failed, delivering inside the request", error);
    }
  }
  await fanOutPostNotifications(postId);
}

/// Creates the in-app notification for every recipient and the LINE rows the worker will push.
export async function fanOutPostNotifications(postId: string): Promise<number> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId },
    include: {
      topic: { select: { name: true } },
      receipts: { select: { userId: true } },
    },
  });
  if (!post) return 0;

  const urgent = post.priority === "URGENT" || post.priority === "CRITICAL";
  const body = post.summary?.trim() ? post.summary.trim() : toPlainText(post.content, 200);
  const linkPath = `/posts/${post.id}`;
  const type = post.requiresConfirmation ? "CONFIRMATION_REQUIRED" : "NEW_POST";

  const drafts = post.receipts.map((receipt) => ({
    userId: receipt.userId,
    type: type as "CONFIRMATION_REQUIRED" | "NEW_POST",
    title: `[${post.topic.name}] ${post.title}`,
    body,
    linkPath,
    postId: post.id,
    isUrgent: urgent || post.requiresConfirmation,
  }));

  const count = await createInAppNotifications(drafts);

  // LINE push goes to employees who linked their account.
  const linked = await prisma.user.findMany({
    where: { id: { in: post.receipts.map((r) => r.userId) }, lineUserId: { not: null } },
    select: { id: true },
  });
  const linkedIds = new Set(linked.map((user) => user.id));
  const lineDrafts = drafts.filter((draft) => linkedIds.has(draft.userId));
  const notificationIds = await createLineNotifications(lineDrafts);

  const boss = await getPublisher(env().DATABASE_URL);
  if (boss) {
    for (const notificationId of notificationIds) {
      await boss.send(QUEUES.lineNotify, { notificationId });
    }
  }

  return count;
}

/// Mention notifications for a comment. Department, branch and group mentions expand to members.
export async function notifyMentions(
  content: string,
  context: { postId: string; commentId: string; actor: ActorContext; postTitle: string },
): Promise<number> {
  const mentions = parseMentions(content);
  if (mentions.length === 0) return 0;

  const userIds = new Set<string>();
  for (const mention of mentions) {
    if (mention.kind === "user") {
      userIds.add(mention.id);
      continue;
    }
    const where: Prisma.UserWhereInput = { status: "ACTIVE" };
    if (mention.kind === "department") where.departmentId = mention.id;
    if (mention.kind === "branch") where.branchId = mention.id;
    if (mention.kind === "group") where.groupMemberships = { some: { groupId: mention.id } };
    const members = await prisma.user.findMany({ where, select: { id: true } });
    for (const member of members) userIds.add(member.id);
  }
  userIds.delete(context.actor.userId);
  if (userIds.size === 0) return 0;

  return createInAppNotifications(
    [...userIds].map((userId) => ({
      userId,
      type: "MENTION" as const,
      title: `${context.actor.fullName} กล่าวถึงคุณ`,
      body: context.postTitle,
      linkPath: `/posts/${context.postId}#comment-${context.commentId}`,
      postId: context.postId,
      commentId: context.commentId,
    })),
  );
}
