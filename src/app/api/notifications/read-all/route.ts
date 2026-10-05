import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

export async function POST() {
  try {
    const actor = await requireActor();
    const result = await prisma.communicationNotification.updateMany({
      where: { userId: actor.userId, channel: "IN_APP", readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
