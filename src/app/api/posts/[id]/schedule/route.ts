import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { schedulePost } from "@/server/post-editor";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({ scheduledAt: z.coerce.date() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "เวลาที่ตั้งไม่ถูกต้อง");
    await schedulePost(actor, id, parsed.data.scheduledAt, await clientIp());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
