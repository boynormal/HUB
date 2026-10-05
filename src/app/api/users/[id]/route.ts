import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isSystemAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  fullName: z.string().trim().min(1, "ใส่ชื่อ-นามสกุล").max(200),
  branchId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  positionId: z.string().uuid().nullable(),
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (!isSystemAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageUsers, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการผู้ใช้");
    }
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");

    const user = await prisma.user.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName,
        branchId: parsed.data.branchId,
        departmentId: parsed.data.departmentId,
        positionId: parsed.data.positionId,
        status: parsed.data.status,
      },
      select: { id: true, employeeCode: true, fullName: true },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.userUpdated,
      entity: "user",
      entityId: user.id,
      ipAddress: await clientIp(),
      metadata: { employeeCode: user.employeeCode, fullName: user.fullName },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
