import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError } from "@/server/auth/actor";
import { signInWithPassword } from "@/server/auth/account";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  employeeCode: z.string().trim().min(1, "กรอกรหัสพนักงาน"),
  password: z.string().min(1, "กรอกรหัสผ่าน"),
});

/// Fallback sign-in for admin accounts. Only accounts holding an admin role can use it.
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }
    const result = await signInWithPassword(parsed.data, await clientIp());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
