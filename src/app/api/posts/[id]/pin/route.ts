import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { setPinned } from "@/server/post-editor";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({ isPinned: z.boolean() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "ค่าปักหมุดไม่ถูกต้อง");
    await setPinned(actor, id, parsed.data.isPinned, await clientIp());
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
