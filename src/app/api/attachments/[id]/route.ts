import { NextResponse } from "next/server";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { canManagePostRecord, canViewPost } from "@/server/posts";
import { readAttachment } from "@/server/attachments";
import { jsonError } from "@/server/http";

/// Files live outside the web root, so every download passes an access check and is audited.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const attachment = await prisma.communicationAttachment.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        postId: true,
        commentId: true,
        fileName: true,
        storedName: true,
        mimeType: true,
        comment: { select: { postId: true } },
      },
    });
    if (!attachment) throw new HttpError(404, "ไม่พบไฟล์นี้");

    const postId = attachment.postId ?? attachment.comment?.postId ?? null;
    if (!postId) throw new HttpError(404, "ไม่พบประกาศของไฟล์นี้");
    if (!(await canViewPost(actor, postId))) throw new HttpError(403, "ไฟล์นี้ไม่ได้ส่งถึงคุณ");

    const bytes = await readAttachment(attachment.storedName);
    const inline = new URL(request.url).searchParams.get("inline") === "1" && attachment.mimeType.startsWith("image/");
    if (!inline) {
      await prisma.communicationAttachment.update({
        where: { id: attachment.id },
        data: { downloadCount: { increment: 1 } },
      });
      await recordAudit({
        userId: actor.userId,
        action: AUDIT.fileDownloaded,
        entity: "attachment",
        entityId: attachment.id,
        ipAddress: await clientIp(),
        metadata: { postId },
      });
    }

    const disposition = inline ? "inline" : "attachment";
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Cache-Control": inline ? "private, max-age=300" : "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

/// Soft delete. Only someone who can edit the post may remove a file.
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const attachment = await prisma.communicationAttachment.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, postId: true, post: { select: { topicId: true, authorId: true } } },
    });
    if (!attachment?.postId || !attachment.post) throw new HttpError(404, "ไม่พบไฟล์นี้");
    if (!canManagePostRecord(actor, attachment.post)) {
      throw new HttpError(403, "ไม่มีสิทธิ์ลบไฟล์นี้");
    }
    await prisma.communicationAttachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.fileUploaded,
      entity: "attachment",
      entityId: attachment.id,
      ipAddress: await clientIp(),
      metadata: { postId: attachment.postId, removed: true },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
