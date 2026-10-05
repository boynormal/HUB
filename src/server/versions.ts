import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/actor";
import type { ActorContext } from "@/server/rbac";
import { canManagePostRecord } from "@/server/posts";
import { sanitizePostContent } from "@/server/sanitize";

export const MANUAL_TYPES = ["PROCEDURE", "DOCUMENT"] as const;

export function isManualType(postType: string): boolean {
  return (MANUAL_TYPES as readonly string[]).includes(postType);
}

export type StoredVersion = {
  id: string;
  label: string;
  title: string;
  summary: string | null;
  content: string;
  isCurrent: boolean;
  publishedAt: Date;
  files: Array<{ id: string; fileName: string; fileSize: number }>;
};

/// Editions already saved, oldest first. The post row is still the copy employees see.
export async function listVersions(postId: string): Promise<StoredVersion[]> {
  const rows = await prisma.communicationPostVersion.findMany({
    where: { postId },
    orderBy: { publishedAt: "asc" },
    include: {
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, fileSize: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    title: row.title,
    summary: row.summary,
    content: row.content,
    isCurrent: row.isCurrent,
    publishedAt: row.publishedAt,
    files: row.attachments,
  }));
}

/// Saves the current edition, then replaces the post body. Receipts are left untouched.
export async function publishNextVersion(
  actor: ActorContext,
  postId: string,
  input: { label: string; title: string; summary?: string | null; content: string },
): Promise<{ id: string; label: string }> {
  const label = input.label.trim();
  if (!/^\d+\.\d+$/.test(label)) throw new HttpError(400, "ป้ายเวอร์ชันใช้รูปแบบ 1.0");
  const title = input.title.trim();
  if (title.length < 3) throw new HttpError(400, "หัวเรื่องสั้นเกินไป");
  const content = sanitizePostContent(input.content);
  if (content.replace(/<[^>]*>/g, "").trim().length === 0) {
    throw new HttpError(400, "ใส่เนื้อหาของเวอร์ชันใหม่");
  }

  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      topicId: true,
      authorId: true,
      postType: true,
      title: true,
      summary: true,
      content: true,
    },
  });
  if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
  if (!isManualType(post.postType)) throw new HttpError(400, "ออกเวอร์ชันได้เฉพาะคู่มือและเอกสาร");
  if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์ออกเวอร์ชันของประกาศนี้");

  const taken = await prisma.communicationPostVersion.findUnique({
    where: { postId_label: { postId, label } },
    select: { id: true },
  });
  if (taken) throw new HttpError(400, `มีเวอร์ชัน ${label} แล้ว`);

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.communicationPostVersion.findMany({
      where: { postId },
      select: { id: true, isCurrent: true, label: true },
    });

    if (existing.length === 0) {
      const archived = await tx.communicationPostVersion.create({
        data: {
          postId,
          label: "1.0",
          title: post.title,
          summary: post.summary,
          content: post.content,
          isCurrent: false,
          publishedAt: now,
          createdBy: actor.userId,
        },
      });
      await tx.communicationAttachment.updateMany({
        where: { postId, postVersionId: null, deletedAt: null },
        data: { postVersionId: archived.id },
      });
    } else {
      await tx.communicationPostVersion.updateMany({
        where: { postId, isCurrent: true },
        data: { isCurrent: false },
      });
      const current = existing.find((row) => row.isCurrent);
      if (current) {
        await tx.communicationAttachment.updateMany({
          where: { postId, postVersionId: null, deletedAt: null },
          data: { postVersionId: current.id },
        });
      }
    }

    if (label === "1.0" && existing.length === 0) {
      throw new HttpError(400, "เวอร์ชันแรกถูกเก็บเป็น 1.0 แล้ว ใช้ป้ายถัดไปเช่น 1.1 หรือ 2.0");
    }

    const next = await tx.communicationPostVersion.create({
      data: {
        postId,
        label,
        title,
        summary: input.summary?.trim() || null,
        content,
        isCurrent: true,
        publishedAt: now,
        createdBy: actor.userId,
      },
    });
    await tx.communicationPost.update({
      where: { id: postId },
      data: {
        title,
        summary: input.summary?.trim() || null,
        content,
      },
    });
    return next;
  });

  return { id: created.id, label: created.label };
}
