import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  name: z.string().trim().min(1, "ใส่ชื่อแท็ก").max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,50}$/, "slug ใช้ a-z, 0-9 และ - เท่านั้น"),
  color: z.string().trim().max(20).optional().nullable(),
});

export async function GET() {
  try {
    await requireActor();
    const tags = await prisma.communicationTag.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    });
    return NextResponse.json({ tags });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageTags, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์จัดการแท็ก");
    }
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const duplicate = await prisma.communicationTag.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new HttpError(409, "ชื่อแท็กนี้มีอยู่แล้ว");
    const tag = await prisma.communicationTag.create({
      data: parsed.data,
      select: { id: true, name: true, slug: true },
    });
    await recordAudit({
      userId: actor.userId,
      action: AUDIT.tagChanged,
      entity: "tag",
      entityId: tag.id,
      ipAddress: await clientIp(),
      metadata: { created: true, name: tag.name },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
