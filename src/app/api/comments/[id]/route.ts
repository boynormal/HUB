import { NextResponse } from "next/server";
import { clientIp, requireActor } from "@/server/auth/actor";
import { deleteComment } from "@/server/comments";
import { jsonError } from "@/server/http";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await deleteComment(actor, id, await clientIp());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
