import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { isCommunicationAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  managerUserId: z.string().uuid().nullable(),
});

/// One manager per department. A null value clears the current manager.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor)) throw new HttpError(403, "ไม่มีสิทธิ์ตั้งผู้จัดการแผนก");
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลผู้จัดการไม่ถูกต้อง");

    const department = await prisma.department.findFirst({
      where: { id, companyId: actor.companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!department) throw new HttpError(404, "ไม่พบแผนกนี้");

    if (parsed.data.managerUserId) {
      const manager = await prisma.user.findFirst({
        where: { id: parsed.data.managerUserId, companyId: actor.companyId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!manager) throw new HttpError(400, "เลือกได้เฉพาะพนักงานที่ใช้งานอยู่");
    }

    await prisma.department.update({
      where: { id: department.id },
      data: { managerUserId: parsed.data.managerUserId },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.userUpdated,
      entity: "department",
      entityId: department.id,
      ipAddress: await clientIp(),
      metadata: { name: department.name, managerUserId: parsed.data.managerUserId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
