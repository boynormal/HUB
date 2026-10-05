import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import {
  PERMISSIONS,
  hasScopedPermission,
  isCommunicationAdmin,
  type ActorContext,
} from "@/server/rbac";
import { canManagePostRecord } from "@/server/posts";
import { sanitizePostContent } from "@/server/sanitize";
import { countRecipients, resolveRecipientIds, syncReceipts } from "@/server/recipients";

const targetSchema = z.object({
  targetType: z.enum([
    "ALL",
    "COMPANY",
    "BRANCH",
    "DEPARTMENT",
    "POSITION",
    "ROLE",
    "USER",
    "GROUP",
  ]),
  targetId: z.string().uuid().nullable().default(null),
});

export const postInputSchema = z.object({
  topicId: z.string().uuid("เลือกหัวข้อ"),
  postType: z
    .enum([
      "ANNOUNCEMENT",
      "NEWS",
      "ALERT",
      "PROCEDURE",
      "TRAINING",
      "EVENT",
      "QUESTION",
      "DOCUMENT",
      "INSTRUCTION",
      "POLL",
    ])
    .default("ANNOUNCEMENT"),
  title: z.string().trim().min(3, "หัวเรื่องสั้นเกินไป").max(200),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, "ใส่เนื้อหาก่อน"),
  priority: z.enum(["NORMAL", "INFO", "IMPORTANT", "URGENT", "CRITICAL"]).default("NORMAL"),
  requiresRead: z.boolean().default(true),
  requiresConfirmation: z.boolean().default(false),
  confirmationDeadline: z.coerce.date().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  allowComments: z.boolean().default(true),
  isPinned: z.boolean().default(false),
  coverImagePath: z.string().max(400).nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  targets: z.array(targetSchema).default([]),
});

export type PostInput = z.infer<typeof postInputSchema>;

function validateDates(input: PostInput): void {
  if (input.requiresConfirmation && !input.confirmationDeadline) {
    throw new HttpError(400, "ประกาศที่ต้องรับทราบต้องมีกำหนดเวลา");
  }
  if (input.expiresAt && input.scheduledAt && input.expiresAt <= input.scheduledAt) {
    throw new HttpError(400, "เวลาหมดอายุต้องหลังเวลาเผยแพร่");
  }
  if (
    input.confirmationDeadline &&
    input.scheduledAt &&
    input.confirmationDeadline <= input.scheduledAt
  ) {
    throw new HttpError(400, "กำหนดรับทราบต้องหลังเวลาเผยแพร่");
  }
}

function requireCreate(actor: ActorContext, topicId: string): void {
  if (isCommunicationAdmin(actor)) return;
  if (!hasScopedPermission(actor, PERMISSIONS.create, { topicId })) {
    throw new HttpError(403, "ไม่มีสิทธิ์สร้างประกาศในหัวข้อนี้");
  }
}

export async function createPost(actor: ActorContext, input: PostInput, ip: string | null) {
  requireCreate(actor, input.topicId);
  validateDates(input);

  const post = await prisma.communicationPost.create({
    data: {
      topicId: input.topicId,
      postType: input.postType,
      title: input.title,
      summary: input.summary?.trim() || null,
      content: sanitizePostContent(input.content),
      priority: input.priority,
      status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
      authorId: actor.userId,
      scheduledAt: input.scheduledAt ?? null,
      expiresAt: input.expiresAt ?? null,
      requiresRead: input.requiresRead,
      requiresConfirmation: input.requiresConfirmation,
      confirmationDeadline: input.confirmationDeadline ?? null,
      allowComments: input.allowComments,
      coverImagePath: input.coverImagePath ?? null,
      tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      targets: {
        create: input.targets.map((target) => ({
          targetType: target.targetType,
          targetId: target.targetId ?? null,
        })),
      },
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postCreated,
    entity: "post",
    entityId: post.id,
    ipAddress: ip,
    metadata: { title: input.title, status: input.scheduledAt ? "SCHEDULED" : "DRAFT" },
  });
  return post;
}

export async function updatePost(
  actor: ActorContext,
  postId: string,
  input: PostInput,
  ip: string | null,
) {
  const existing = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: { targets: true },
  });
  if (!existing) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!canManagePostRecord(actor, existing)) throw new HttpError(403, "ไม่มีสิทธิ์แก้ประกาศนี้");
  validateDates(input);

  await prisma.$transaction(async (tx) => {
    await tx.communicationPost.update({
      where: { id: postId },
      data: {
        topicId: input.topicId,
        postType: input.postType,
        title: input.title,
        summary: input.summary?.trim() || null,
        content: sanitizePostContent(input.content),
        priority: input.priority,
        scheduledAt: existing.status === "PUBLISHED" ? existing.scheduledAt : input.scheduledAt ?? null,
        expiresAt: input.expiresAt ?? null,
        requiresRead: input.requiresRead,
        requiresConfirmation: input.requiresConfirmation,
        confirmationDeadline: input.confirmationDeadline ?? null,
        allowComments: input.allowComments,
        coverImagePath: input.coverImagePath ?? null,
      },
    });
    await tx.communicationPostTag.deleteMany({ where: { postId } });
    if (input.tagIds.length > 0) {
      await tx.communicationPostTag.createMany({
        data: input.tagIds.map((tagId) => ({ postId, tagId })),
        skipDuplicates: true,
      });
    }
    if (input.targets.length > 0) {
      await tx.communicationPostTarget.deleteMany({ where: { postId } });
      await tx.communicationPostTarget.createMany({
        data: input.targets.map((target) => ({
          postId,
          targetType: target.targetType,
          targetId: target.targetId ?? null,
        })),
        skipDuplicates: true,
      });
    }
  });

  // Widening the audience of a published post delivers to the people who were added. Existing
  // receipts are untouched, so nobody loses an acknowledgement they already gave.
  let addedReceipts = 0;
  if (existing.status === "PUBLISHED" && input.targets.length > 0) {
    const recipientIds = await resolveRecipientIds(input.targets);
    addedReceipts = await syncReceipts(postId, recipientIds);
  }

  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postUpdated,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: { addedReceipts },
  });
  return { addedReceipts };
}

export async function schedulePost(
  actor: ActorContext,
  postId: string,
  scheduledAt: Date,
  ip: string | null,
) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: { targets: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์แก้ประกาศนี้");
  if (post.status === "PUBLISHED") throw new HttpError(400, "ประกาศนี้เผยแพร่แล้ว");
  if (post.targets.length === 0) throw new HttpError(400, "ต้องเลือกผู้รับก่อนตั้งเวลา");
  if (scheduledAt.getTime() <= Date.now()) throw new HttpError(400, "เวลาที่ตั้งต้องเป็นอนาคต");

  await prisma.communicationPost.update({
    where: { id: postId },
    data: { status: "SCHEDULED", scheduledAt },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postScheduled,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: { scheduledAt: scheduledAt.toISOString() },
  });
}

export async function setPinned(
  actor: ActorContext,
  postId: string,
  isPinned: boolean,
  ip: string | null,
) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: { topic: { select: { maxPinned: true, name: true } } },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์ปักหมุดประกาศนี้");

  if (isPinned) {
    const pinned = await prisma.communicationPost.count({
      where: { topicId: post.topicId, isPinned: true, deletedAt: null, id: { not: postId } },
    });
    if (pinned >= post.topic.maxPinned) {
      throw new HttpError(
        400,
        `หัวข้อ ${post.topic.name} ปักหมุดได้ไม่เกิน ${post.topic.maxPinned} ประกาศ`,
      );
    }
  }

  await prisma.communicationPost.update({ where: { id: postId }, data: { isPinned } });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postPinned,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: { isPinned },
  });
}

export async function archivePost(actor: ActorContext, postId: string, ip: string | null) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, topicId: true, authorId: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (
    !isCommunicationAdmin(actor) &&
    !hasScopedPermission(actor, PERMISSIONS.archive, {
      topicId: post.topicId,
      ownerId: post.authorId,
    })
  ) {
    throw new HttpError(403, "ไม่มีสิทธิ์เก็บประกาศนี้");
  }
  await prisma.communicationPost.update({
    where: { id: postId },
    data: { status: "ARCHIVED", isPinned: false },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postArchived,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
  });
}

/// Business communication is never removed from the database, only hidden.
export async function softDeletePost(actor: ActorContext, postId: string, ip: string | null) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, topicId: true, authorId: true, title: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (
    !isCommunicationAdmin(actor) &&
    !hasScopedPermission(actor, PERMISSIONS.delete, {
      topicId: post.topicId,
      ownerId: post.authorId,
    })
  ) {
    throw new HttpError(403, "ไม่มีสิทธิ์ลบประกาศนี้");
  }
  await prisma.communicationPost.update({
    where: { id: postId },
    data: { deletedAt: new Date(), status: "CANCELLED", isPinned: false },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postUpdated,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: { softDeleted: true, title: post.title },
  });
}

/// Puts a hidden post back on the feed. Existing acknowledgements stay.
export async function restorePost(actor: ActorContext, postId: string, ip: string | null) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: { not: null } },
    select: { id: true, topicId: true, authorId: true, title: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศที่ลบแล้ว");
  if (
    !isCommunicationAdmin(actor) &&
    !hasScopedPermission(actor, PERMISSIONS.delete, {
      topicId: post.topicId,
      ownerId: post.authorId,
    })
  ) {
    throw new HttpError(403, "ไม่มีสิทธิ์นำประกาศกลับมา");
  }
  await prisma.communicationPost.update({
    where: { id: postId },
    data: { deletedAt: null, status: "PUBLISHED" },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.postUpdated,
    entity: "post",
    entityId: postId,
    ipAddress: ip,
    metadata: { restored: true, title: post.title },
  });
}

/// Powers the "ส่งถึง N คน" line in the composer before anything is published.
export async function previewRecipients(actor: ActorContext, targets: PostInput["targets"]) {
  if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageRecipients, {})) {
    if (!hasScopedPermission(actor, PERMISSIONS.create, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์ดูจำนวนผู้รับ");
    }
  }
  const count = await countRecipients(targets);
  return { count };
}

export type DraftListItem = {
  id: string;
  title: string;
  status: string;
  topicName: string;
  priority: string;
  scheduledAt: Date | null;
  updatedAt: Date;
  recipientCount: number;
};

/// Posts the actor may manage: their own drafts plus everything in the topics they run.
export async function listManagedPosts(
  actor: ActorContext,
  options: { status?: string | null; take: number; skip: number },
): Promise<{ items: DraftListItem[]; total: number }> {
  const where: Prisma.CommunicationPostWhereInput = { deletedAt: null };
  if (options.status) {
    where.status = options.status as Prisma.CommunicationPostWhereInput["status"];
  }
  if (!isCommunicationAdmin(actor)) {
    where.OR = [
      { authorId: actor.userId },
      ...(actor.managedTopicIds.length > 0 ? [{ topicId: { in: actor.managedTopicIds } }] : []),
    ];
  }

  const [posts, total] = await Promise.all([
    prisma.communicationPost.findMany({
      where,
      include: {
        topic: { select: { name: true } },
        _count: { select: { receipts: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: options.take,
      skip: options.skip,
    }),
    prisma.communicationPost.count({ where }),
  ]);

  return {
    items: posts.map((post) => ({
      id: post.id,
      title: post.title,
      status: post.status,
      topicName: post.topic.name,
      priority: post.priority,
      scheduledAt: post.scheduledAt,
      updatedAt: post.updatedAt,
      recipientCount: post._count.receipts,
    })),
    total,
  };
}
