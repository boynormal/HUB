import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { createComment, loadComments } from "@/server/comments";
import { canViewPost } from "@/server/posts";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  content: z.string().trim().min(1, "พิมพ์ข้อความก่อนส่ง").max(4000),
  parentId: z.string().uuid().nullable().optional(),
});

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
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const created = await createComment(
      actor,
      { postId: id, content: parsed.data.content, parentId: parsed.data.parentId ?? null },
      await clientIp(),
    );
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
