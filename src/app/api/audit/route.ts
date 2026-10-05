import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { isSystemAdmin } from "@/server/rbac";
import { jsonError, pagination } from "@/server/http";

/// Read only. Audit rows are never edited or removed by the application.
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (!isSystemAdmin(actor)) throw new HttpError(403, "เฉพาะผู้ดูแลระบบเท่านั้น");

    const url = new URL(request.url);
    const { take, skip } = pagination(url, 50, 200);
    const where: Prisma.CommunicationAuditLogWhereInput = {};
    const action = url.searchParams.get("action");
    const entity = url.searchParams.get("entity");
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [rows, total] = await Promise.all([
      prisma.communicationAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          user: { select: { fullName: true, employeeCode: true } },
        },
      }),
      prisma.communicationAuditLog.count({ where }),
    ]);

    return NextResponse.json({ rows, total });
  } catch (error) {
    return jsonError(error);
  }
}
