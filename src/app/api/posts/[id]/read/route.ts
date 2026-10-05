import { NextResponse } from "next/server";
import { clientIp, requireActor } from "@/server/auth/actor";
import { markRead } from "@/server/posts";
import { jsonError } from "@/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const readAt = await markRead(actor, id, await clientIp());
    return NextResponse.json({ ok: true, readAt });
  } catch (error) {
    return jsonError(error);
  }
}
