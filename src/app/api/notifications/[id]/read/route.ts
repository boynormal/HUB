import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    // Scoped by user id so nobody can mark someone else's notification read.
    await prisma.communicationNotification.updateMany({
      where: { id, userId: actor.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
