import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อหัวข้อ").max(100),
  color: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean(),
  maxPinned: z.number().int().min(0).max(10),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageTopics, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการหัวข้อ");
    }
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");

    const duplicate = await prisma.communicationTopic.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" }, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, "ชื่อหัวข้อนี้มีอยู่แล้ว");

    const topic = await prisma.communicationTopic.update({
      where: { id },
      data: {
        name: parsed.data.name,
        color: parsed.data.color || null,
        isActive: parsed.data.isActive,
        maxPinned: parsed.data.maxPinned,
      },
      select: { id: true, name: true },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.topicChanged,
      entity: "topic",
      entityId: topic.id,
      ipAddress: await clientIp(),
      metadata: { name: topic.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
