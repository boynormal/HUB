import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อแท็ก").max(60),
  isActive: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageTags, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการแท็ก");
    }
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");

    const duplicate = await prisma.communicationTag.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, "ชื่อแท็กนี้มีอยู่แล้ว");

    const tag = await prisma.communicationTag.update({
      where: { id },
      data: { name: parsed.data.name, isActive: parsed.data.isActive },
      select: { id: true, name: true },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.tagChanged,
      entity: "tag",
      entityId: tag.id,
      ipAddress: await clientIp(),
      metadata: { name: tag.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
