import { NextResponse } from "next/server";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { generateInviteCode, hashSecret } from "@/server/auth/password";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isSystemAdmin } from "@/server/rbac";
import { jsonError } from "@/server/http";

/// Replaces the stored invite hash. The plain code is returned once.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (!isSystemAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageUsers, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการผู้ใช้");
    }
    const { id } = await context.params;
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, employeeCode: true },
    });
    if (!existing) throw new HttpError(404, "ไม่พบพนักงาน");

    const inviteCode = generateInviteCode();
    await prisma.user.update({
      where: { id },
      data: { inviteCodeHash: await hashSecret(inviteCode) },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.userUpdated,
      entity: "user",
      entityId: existing.id,
      ipAddress: await clientIp(),
      metadata: { employeeCode: existing.employeeCode, inviteReissued: true },
    });
    return NextResponse.json({ inviteCode });
  } catch (error) {
    return jsonError(error);
  }
}
