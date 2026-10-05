import { NextResponse } from "next/server";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { loadPostDetail } from "@/server/post-detail";
import { postInputSchema, softDeletePost, updatePost } from "@/server/post-editor";
import { jsonError, readJson } from "@/server/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return NextResponse.json(await loadPostDetail(actor, id));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const parsed = postInputSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const result = await updatePost(actor, id, parsed.data, await clientIp());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await softDeletePost(actor, id, await clientIp());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
