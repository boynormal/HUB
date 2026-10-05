import { NextResponse } from "next/server";
import { HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { canManagePostRecord } from "@/server/posts";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { jsonError } from "@/server/http";

/// Who read and who still owes an acknowledgement. Managers see this; employees do not.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const post = await prisma.communicationPost.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, topicId: true, authorId: true },
    });
    if (!post) throw new HttpError(404, "ไม่พบประกาศนี้");

    const allowed =
      isCommunicationAdmin(actor) ||
      canManagePostRecord(actor, post) ||
      hasScopedPermission(actor, PERMISSIONS.viewReports, { topicId: post.topicId });
    if (!allowed) throw new HttpError(403, "ไม่มีสิทธิ์ดูรายชื่อผู้รับ");

    const state = new URL(request.url).searchParams.get("state");
    const receipts = await prisma.communicationPostReceipt.findMany({
      where: {
        postId: id,
        ...(state === "pending" ? { acknowledgedAt: null } : {}),
        ...(state === "unread" ? { readAt: null } : {}),
        ...(state === "acknowledged" ? { acknowledgedAt: { not: null } } : {}),
      },
      select: {
        id: true,
        readAt: true,
        acknowledgedAt: true,
        acknowledgeNote: true,
        user: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ acknowledgedAt: "asc" }, { user: { fullName: "asc" } }],
      take: 500,
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    return jsonError(error);
  }
}
