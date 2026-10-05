import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { clientIp, HttpError } from "@/server/auth/actor";
import { linkLineAccount } from "@/server/auth/account";
import { identityFromLiffAccessToken } from "@/server/auth/line";
import { PENDING_LINE_COOKIE } from "@/server/auth/line-flow";
import { jsonError, readJson } from "@/server/http";

const schema = z.object({
  employeeCode: z.string().trim().min(1, "กรอกรหัสพนักงาน").max(50),
  inviteCode: z.string().trim().min(4, "กรอกรหัสเชิญ").max(20),
  accessToken: z.string().optional(),
  displayName: z.string().max(200).optional(),
});

/// Links the LINE account the server already verified. The browser cannot name another LINE id:
/// the id comes from the pending cookie, or from a LIFF token verified with LINE here.
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }

    let lineUserId: string | null = null;
    let pictureUrl: string | null = null;
    let displayName = parsed.data.displayName ?? null;

    if (parsed.data.accessToken) {
      const identity = await identityFromLiffAccessToken(parsed.data.accessToken).catch(() => {
        throw new HttpError(401, "ยืนยันตัวตนกับ LINE ไม่สำเร็จ");
      });
      lineUserId = identity.lineUserId;
      pictureUrl = identity.pictureUrl;
      displayName = identity.displayName;
    } else {
      const store = await cookies();
      lineUserId = store.get(PENDING_LINE_COOKIE)?.value ?? null;
    }

    if (!lineUserId) throw new HttpError(400, "เริ่มการเข้าสู่ระบบด้วย LINE ใหม่อีกครั้ง");

    const linked = await linkLineAccount(
      {
        employeeCode: parsed.data.employeeCode,
        inviteCode: parsed.data.inviteCode,
        identity: { lineUserId, displayName, pictureUrl },
      },
      await clientIp(),
    );

    const response = NextResponse.json({ ok: true, ...linked });
    response.cookies.delete(PENDING_LINE_COOKIE);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
