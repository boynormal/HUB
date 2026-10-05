import { NextResponse } from "next/server";
import { clientIp, requireActor } from "@/server/auth/actor";
import { acknowledgePost } from "@/server/posts";
import { jsonError } from "@/server/http";

/// Only the signed-in employee can acknowledge, and only their own receipt.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const body = await request
      .json()
      .catch(() => ({}) as { note?: string });
    const acknowledgedAt = await acknowledgePost(
      actor,
      id,
      typeof body.note === "string" ? body.note : null,
      await clientIp(),
    );
    return NextResponse.json({ ok: true, acknowledgedAt });
  } catch (error) {
    return jsonError(error);
  }
}
