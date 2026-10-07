import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { createComment, loadComments } from "@/server/comments";
import { canViewPost } from "@/server/posts";
import { jsonError } from "@/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    if (!(await canViewPost(actor, id))) throw new HttpError(404, "ไม่พบประกาศนี้");
    return NextResponse.json({ comments: await loadComments(actor, id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const form = await request.formData().catch(() => null);
    if (!form) throw new HttpError(400, "ข้อมูลไม่ครบ");

    const content = String(form.get("content") ?? "").trim();
    if (content.length > 4000) throw new HttpError(400, "ข้อความยาวเกิน 4000 ตัวอักษร");
    const parentRaw = form.get("parentId");
    const parentId = typeof parentRaw === "string" && parentRaw.length > 0 ? parentRaw : null;
    if (parentId && !z.string().uuid().safeParse(parentId).success) {
      throw new HttpError(400, "ไม่พบความคิดเห็นที่ตอบกลับ");
    }

    const files = form.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
    const images = await Promise.all(
      files.map(async (file) => ({
        fileName: file.name,
        mimeType: file.type,
        bytes: Buffer.from(await file.arrayBuffer()),
      })),
    );

    const created = await createComment(
      actor,
      { postId: id, content, parentId, images },
      await clientIp(),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
