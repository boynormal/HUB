import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import { isSystemAdmin, type ActorContext } from "@/server/rbac";
import { canViewPost, notifyMentions } from "@/server/posts";
import { mentionsToPlainText } from "@/server/mentions";
import { sanitizeCommentContent, toPlainText } from "@/server/sanitize";
import { createInAppNotifications } from "@/server/notifications";

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
  replies: CommentNode[];
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

export async function createComment(
  actor: ActorContext,
  input: { postId: string; content: string; parentId?: string | null },
  ip: string | null,
): Promise<{ id: string }> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: input.postId, deletedAt: null },
    select: { id: true, title: true, allowComments: true, authorId: true, status: true },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!post.allowComments) throw new HttpError(403, "ประกาศนี้ปิดการแสดงความคิดเห็น");
  if (!(await canViewPost(actor, input.postId))) throw new HttpError(403, "ประกาศนี้ไม่ได้ส่งถึงคุณ");

  const content = sanitizeCommentContent(input.content);
  if (toPlainText(content).length === 0) throw new HttpError(400, "พิมพ์ข้อความก่อนส่ง");

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

  await recordAudit({
    userId: actor.userId,
    action: AUDIT.commentCreated,
    entity: "comment",
    entityId: comment.id,
    ipAddress: ip,
    metadata: { postId: input.postId },
  });

  await notifyThread(actor, post, { ...comment, excerpt: toPlainText(mentionsToPlainText(content), 140) });
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

  await prisma.communicationComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date(), status: "DELETED" },
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
