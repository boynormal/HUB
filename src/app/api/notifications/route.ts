import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError, pagination } from "@/server/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const { take, skip } = pagination(url, 30, 100);
    const filter = url.searchParams.get("filter") ?? "all";

    const where: Prisma.CommunicationNotificationWhereInput = {
      userId: actor.userId,
      channel: "IN_APP",
    };
    if (filter === "unread") where.readAt = null;
    if (filter === "urgent") where.isUrgent = true;
    if (filter === "confirmation") {
      where.type = { in: ["CONFIRMATION_REQUIRED", "CONFIRMATION_REMINDER", "DEADLINE"] };
    }

    const [notifications, unread] = await Promise.all([
      prisma.communicationNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          linkPath: true,
          isUrgent: true,
          readAt: true,
          createdAt: true,
        },
      }),
      prisma.communicationNotification.count({
        where: { userId: actor.userId, channel: "IN_APP", readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications, unread });
  } catch (error) {
    return jsonError(error);
  }
}
