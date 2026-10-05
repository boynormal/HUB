import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireActor } from "@/server/auth/actor";
import { previewRecipients } from "@/server/post-editor";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  targets: z.array(
    z.object({
      targetType: z.enum([
        "ALL",
        "COMPANY",
        "BRANCH",
        "DEPARTMENT",
        "POSITION",
        "ROLE",
        "USER",
        "GROUP",
      ]),
      targetId: z.string().uuid().nullable().default(null),
    }),
  ),
});

/// Shows "ส่งถึง N คน" while the composer is still open.
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "รายการผู้รับไม่ถูกต้อง");
    return NextResponse.json(await previewRecipients(actor, parsed.data.targets));
  } catch (error) {
    return jsonError(error);
  }
}
