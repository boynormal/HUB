import { NextResponse } from "next/server";
import { clientIp, requireActor } from "@/server/auth/actor";
import { archivePost } from "@/server/post-editor";
import { jsonError } from "@/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    await archivePost(actor, id, await clientIp());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
