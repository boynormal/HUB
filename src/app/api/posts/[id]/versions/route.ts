import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireActor } from "@/server/auth/actor";
import { jsonError, readJson } from "@/server/http";
import { publishNextVersion } from "@/server/versions";

const schema = z.object({
  label: z.string().trim().min(1, "ใส่ป้ายเวอร์ชัน"),
  title: z.string().trim().min(3, "หัวเรื่องสั้นเกินไป").max(200),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(1, "ใส่เนื้อหา"),
});

/// Archives the current edition and updates the post. Acknowledgements stay as they are.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const created = await publishNextVersion(actor, id, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
