import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อหัวข้อ").max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,50}$/, "slug ใช้ a-z, 0-9 และ - เท่านั้น"),
  description: z.string().trim().max(500).optional().nullable(),
  icon: z.string().trim().max(50).optional().nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  managerUserId: z.string().uuid().nullable().optional(),
  maxPinned: z.number().int().min(0).max(10).default(3),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function GET() {
  try {
    await requireActor();
    const topics = await prisma.communicationTopic.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        color: true,
        icon: true,
        maxPinned: true,
        manager: { select: { id: true, fullName: true } },
      },
    });
    return NextResponse.json({ topics });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageTopics, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการหัวข้อ");
    }
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const duplicate = await prisma.communicationTopic.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, "ชื่อหัวข้อนี้มีอยู่แล้ว");
    const topic = await prisma.communicationTopic.create({
      data: { ...parsed.data, createdBy: actor.userId },
      select: { id: true, name: true, slug: true },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.topicChanged,
      entity: "topic",
      entityId: topic.id,
      ipAddress: await clientIp(),
      metadata: { created: true, name: topic.name },
    });
    return NextResponse.json(topic, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
