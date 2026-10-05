import { NextResponse } from "next/server";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { canManagePostRecord } from "@/server/posts";
import { saveAttachment, validateUpload } from "@/server/attachments";
import { jsonError } from "@/server/http";

/// Uploads are checked on extension, MIME type and size before anything touches the disk.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const post = await prisma.communicationPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, topicId: true, authorId: true },
    });
    if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
    if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์แนบไฟล์ในประกาศนี้");

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "ไม่พบไฟล์ที่อัปโหลด");

    validateUpload(file.name, file.type, file.size);
    const bytes = Buffer.from(await file.arrayBuffer());
    const storedName = await saveAttachment(file.name, bytes);

    const versionId = form?.get("versionId");
    let postVersionId: string | null = null;
    if (typeof versionId === "string" && versionId.length > 0) {
      const edition = await prisma.communicationPostVersion.findFirst({
        where: { id: versionId, postId: post.id, isCurrent: true },
        select: { id: true },
      });
      if (!edition) throw new HttpError(400, "เวอร์ชันที่แนบไฟล์ไม่ใช่ฉบับปัจจุบัน");
      postVersionId = edition.id;
    }

    const attachment = await prisma.communicationAttachment.create({
      data: {
        postId: post.id,
        postVersionId,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        fileSize: bytes.byteLength,
        uploadedBy: actor.userId,
      },
      select: { id: true, fileName: true, fileSize: true, mimeType: true },
    });

    await recordAudit({
      userId: actor.userId,
      action: AUDIT.fileUploaded,
      entity: "attachment",
      entityId: attachment.id,
      ipAddress: await clientIp(),
      metadata: { postId: post.id, fileName: file.name, fileSize: bytes.byteLength },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
