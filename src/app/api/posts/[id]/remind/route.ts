import { NextResponse } from "next/server";
import { HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { canManagePostRecord } from "@/server/posts";
import { remindPending } from "@/server/reminder-runner";
import { jsonError } from "@/server/http";

/// Sends the reminder now, on top of the planned ladder.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const post = await prisma.communicationPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, topicId: true, authorId: true, requiresConfirmation: true },
    });
    if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");
    if (!canManagePostRecord(actor, post)) throw new HttpError(403, "ไม่มีสิทธิ์เตือนในประกาศนี้");
    if (!post.requiresConfirmation) throw new HttpError(400, "ประกาศนี้ไม่ต้องกดรับทราบ");

    const count = await remindPending(id);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return jsonError(error);
  }
}
