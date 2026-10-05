import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/actor";
import type { ActorContext } from "@/server/rbac";
import { canManagePostRecord, canViewPost } from "@/server/posts";
import { receiptStatus, type ReceiptStatus } from "@/server/reminders";
import { loadComments, type CommentNode } from "@/server/comments";
import { isManualType, listVersions, type StoredVersion } from "@/server/versions";

export type PostDetail = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  topic: { id: string; name: string; slug: string; color: string | null };
  postType: string;
  priority: string;
  status: string;
  authorName: string;
  authorDepartment: string | null;
  publishedAt: Date | null;
  expiresAt: Date | null;
  requiresConfirmation: boolean;
  confirmationDeadline: Date | null;
  allowComments: boolean;
  isPinned: boolean;
  coverImagePath: string | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  targets: Array<{ targetType: string; targetId: string | null }>;
  scheduledAt: Date | null;
  attachments: Array<{
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }>;
  versions: StoredVersion[];
  currentVersionLabel: string;
  viewer: {
    status: ReceiptStatus;
    readAt: Date | null;
    acknowledgedAt: Date | null;
    acknowledgeNote: string | null;
    isRecipient: boolean;
    canManage: boolean;
  };
  stats: { recipients: number; read: number; acknowledged: number };
  comments: CommentNode[];
};

export async function loadPostDetail(actor: ActorContext, postId: string): Promise<PostDetail> {
  if (!(await canViewPost(actor, postId))) throw new HttpError(404, "ไม่พบประกาศนี้");

  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    include: {
      topic: { select: { id: true, name: true, slug: true, color: true } },
      author: { select: { fullName: true, department: { select: { name: true } } } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      targets: { select: { targetType: true, targetId: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, fileSize: true, mimeType: true, postVersionId: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");

  const now = new Date();
  const versions = isManualType(post.postType) ? await listVersions(postId) : [];
  const currentVersion = versions.find((row) => row.isCurrent) ?? null;
  const visibleFiles = post.attachments.filter((file) => {
    if (!currentVersion) return file.postVersionId === null;
    return file.postVersionId === currentVersion.id || file.postVersionId === null;
  });
  const [receipt, recipients, read, acknowledged, comments] = await Promise.all([
    prisma.communicationPostReceipt.findUnique({
      where: { postId_userId: { postId, userId: actor.userId } },
    }),
    prisma.communicationPostReceipt.count({ where: { postId } }),
    prisma.communicationPostReceipt.count({ where: { postId, readAt: { not: null } } }),
    prisma.communicationPostReceipt.count({ where: { postId, acknowledgedAt: { not: null } } }),
    loadComments(actor, postId),
  ]);

  return {
    id: post.id,
    title: post.title,
    summary: post.summary,
    content: post.content,
    topic: post.topic,
    postType: post.postType,
    priority: post.priority,
    status: post.status,
    authorName: post.author.fullName,
    authorDepartment: post.author.department?.name ?? null,
    publishedAt: post.publishedAt,
    expiresAt: post.expiresAt,
    scheduledAt: post.scheduledAt,
    requiresConfirmation: post.requiresConfirmation,
    confirmationDeadline: post.confirmationDeadline,
    allowComments: post.allowComments,
    isPinned: post.isPinned,
    coverImagePath: post.coverImagePath,
    tags: post.tags.map((link) => link.tag),
    targets: post.targets.map((target) => ({
      targetType: target.targetType,
      targetId: target.targetId,
    })),
    attachments: visibleFiles.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    })),
    versions,
    currentVersionLabel: currentVersion?.label ?? "1.0",
    viewer: {
      status: receiptStatus(receipt, {
        requiresConfirmation: post.requiresConfirmation,
        deadline: post.confirmationDeadline,
        now,
      }),
      readAt: receipt?.readAt ?? null,
      acknowledgedAt: receipt?.acknowledgedAt ?? null,
      acknowledgeNote: receipt?.acknowledgeNote ?? null,
      isRecipient: receipt !== null,
      canManage: canManagePostRecord(actor, post),
    },
    stats: { recipients, read, acknowledged },
    comments,
  };
}
