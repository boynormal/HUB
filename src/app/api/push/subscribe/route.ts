import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { phoneAlertsConfigured } from "@/server/env";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    if (!phoneAlertsConfigured()) throw new HttpError(503, "ยังไม่ได้ตั้งค่าการแจ้งเตือนบนเซิร์ฟเวอร์");
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลการแจ้งเตือนไม่ครบ");
    await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      update: {
        userId: actor.userId,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
      create: {
        userId: actor.userId,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireActor();
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "ข้อมูลการแจ้งเตือนไม่ครบ");
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: actor.userId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
