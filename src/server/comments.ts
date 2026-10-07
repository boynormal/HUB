import path from "node:path";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import { isSystemAdmin, type ActorContext } from "@/server/rbac";
import { canViewPost, notifyMentions } from "@/server/posts";
import { mentionsToPlainText } from "@/server/mentions";
import { sanitizeCommentContent, toPlainText } from "@/server/sanitize";
import { saveAttachment, validateUpload } from "@/server/attachments";
import { createInAppNotifications } from "@/server/notifications";

const COMMENT_IMAGE_LIMIT = 4;
const COMMENT_IMAGE_BYTES = 8 * 1024 * 1024;
const COMMENT_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export type CommentImage = {
  id: string;
  fileName: string;
};

export type CommentNode = {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  avatarUrl: string | null;
  departmentName: string | null;
  isPinned: boolean;
  createdAt: Date;
  canDelete: boolean;
  images: CommentImage[];
  replies: CommentNode[];
};

export type CommentUpload = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_COUNT = 5;

export async function loadComments(actor: ActorContext, postId: string): Promise<CommentNode[]> {
  const rows = await prisma.communicationComment.findMany({
    where: { postId, deletedAt: null, status: "VISIBLE" },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          department: { select: { name: true } },
        },
      },
      attachments: {
        where: { deletedAt: null, mimeType: { startsWith: "image/" } },
        select: { id: true, fileName: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
  });

  const canDeleteOthers = isSystemAdmin(actor);
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      content: row.content,
      authorName: row.user.fullName,
      authorId: row.user.id,
      avatarUrl: row.user.avatarUrl,
      departmentName: row.user.department?.name ?? null,
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      canDelete: canDeleteOthers || row.user.id === actor.userId,
      images: row.attachments.map((file) => ({ id: file.id, fileName: file.fileName })),
      replies: [],
    });
  }
  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? byId.get(row.parentId) : null;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }
  return roots;
}

function assertCommentImages(images: CommentUpload[]): void {
  if (images.length > COMMENT_IMAGE_LIMIT) throw new HttpError(400, "แนบได้ไม่เกิน 4 รูป");
  for (const image of images) {
    const ext = path.extname(image.fileName).toLowerCase();
    if (!COMMENT_IMAGE_EXT.has(ext) || !image.mimeType.toLowerCase().startsWith("image/")) {
      throw new HttpError(415, "ความคิดเห็นแนบได้เฉพาะรูปภาพ");
    }
    if (image.bytes.byteLength > COMMENT_IMAGE_BYTES) throw new HttpError(413, "รูปใหญ่เกิน 8 MB");
    validateUpload(image.fileName, image.mimeType, image.bytes.byteLength);
  }
}

export async function createComment(
  actor: ActorContext,
  input: { postId: string; content: string; parentId?: string | null; images?: CommentUpload[] },
  ip: string | null,
): Promise<{ id: string }> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: input.postId, deletedAt: null },
    select: { id: true, title: true, allowComments: true, authorId: true, status: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!post.allowComments) throw new HttpError(403, "ประกาศนี้ปิดการแสดงความคิดเห็น");
  if (!(await canViewPost(actor, input.postId))) throw new HttpError(403, "ประกาศนี้ไม่ได้ส่งถึงคุณ");

  const images = input.images ?? [];
  assertCommentImages(images);
  const content = sanitizeCommentContent(input.content);
  const plain = toPlainText(content);
  if (plain.length === 0 && images.length === 0) {
    throw new HttpError(400, "พิมพ์ข้อความหรือแนบรูปก่อนส่ง");
  }

  // Keeps one person from flooding a thread.
  const recent = await prisma.communicationComment.count({
    where: {
      userId: actor.userId,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
  });
  if (recent >= RATE_LIMIT_COUNT) throw new HttpError(429, "ส่งความคิดเห็นถี่เกินไป รอสักครู่");

  if (input.parentId) {
    const parent = await prisma.communicationComment.findFirst({
      where: { id: input.parentId, postId: input.postId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new HttpError(400, "ไม่พบความคิดเห็นที่ตอบกลับ");
  }

  const comment = await prisma.communicationComment.create({
    data: {
      postId: input.postId,
      parentId: input.parentId ?? null,
      userId: actor.userId,
      content,
    },
    select: { id: true, parentId: true },
  });

  for (const image of images) {
    const storedName = await saveAttachment(image.fileName, image.bytes);
    await prisma.communicationAttachment.create({
      data: {
        commentId: comment.id,
        fileName: image.fileName,
        storedName,
        mimeType: image.mimeType,
        fileSize: image.bytes.byteLength,
        uploadedBy: actor.userId,
      },
    });
  }

  await recordAudit({
    userId: actor.userId,
    action: AUDIT.commentCreated,
    entity: "comment",
    entityId: comment.id,
    ipAddress: ip,
    metadata: { postId: input.postId },
  });

  const excerpt = plain.length > 0 ? toPlainText(mentionsToPlainText(content), 140) : "ส่งรูปภาพ";
  await notifyThread(actor, post, { ...comment, excerpt });
  await notifyMentions(content, {
    postId: post.id,
    commentId: comment.id,
    actor,
    postTitle: post.title,
  });

  return { id: comment.id };
}

/// People who already took part in the post hear about a new comment. Reading alone does not count.
async function notifyThread(
  actor: ActorContext,
  post: { id: string; title: string; authorId: string },
  comment: { id: string; parentId: string | null; excerpt: string },
): Promise<void> {
  const [acknowledged, commenters, parent] = await Promise.all([
    prisma.communicationPostReceipt.findMany({
      where: { postId: post.id, acknowledgedAt: { not: null } },
      select: { userId: true },
    }),
    prisma.communicationComment.findMany({
      where: { postId: post.id, deletedAt: null },
      select: { userId: true },
      distinct: ["userId"],
    }),
    comment.parentId
      ? prisma.communicationComment.findUnique({
          where: { id: comment.parentId },
          select: { userId: true },
        })
      : Promise.resolve(null),
  ]);

  const targets = new Set<string>([post.authorId]);
  for (const row of acknowledged) targets.add(row.userId);
  for (const row of commenters) targets.add(row.userId);
  const replyUserId = parent?.userId ?? null;
  if (replyUserId) targets.add(replyUserId);
  targets.delete(actor.userId);
  if (targets.size === 0) return;

  const linkPath = `/posts/${post.id}#comment-${comment.id}`;
  await createInAppNotifications(
    [...targets].map((userId) => {
      const isReply = userId === replyUserId;
      return {
        userId,
        type: isReply ? ("REPLY" as const) : ("COMMENT" as const),
        title: isReply
          ? `${actor.fullName} ตอบกลับใน ${post.title}`
          : `${actor.fullName} แสดงความคิดเห็นใน ${post.title}`,
        body: comment.excerpt,
        linkPath,
        postId: post.id,
        commentId: comment.id,
      };
    }),
  );
}

export async function deleteComment(actor: ActorContext, commentId: string, ip: string | null) {
  const comment = await prisma.communicationComment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!comment) throw new HttpError(404, "ไม่พบความคิดเห็นนี้");

  if (comment.userId !== actor.userId && !isSystemAdmin(actor)) {
    throw new HttpError(403, "ลบความคิดเห็นนี้ไม่ได้");
  }

  const deletedAt = new Date();
  await prisma.communicationComment.update({
    where: { id: commentId },
    data: { deletedAt, status: "DELETED" },
  });
  await prisma.communicationAttachment.updateMany({
    where: { commentId, deletedAt: null },
    data: { deletedAt },
  });
  await recordAudit({
    userId: actor.userId,
    action: AUDIT.commentDeleted,
    entity: "comment",
    entityId: commentId,
    ipAddress: ip,
    metadata: { moderated: comment.userId !== actor.userId },
  });
}
