import { NextResponse } from "next/server";
import { clientIp, HttpError } from "@/server/auth/actor";
import { identityFromLiffAccessToken } from "@/server/auth/line";
import { signInWithLine } from "@/server/auth/account";
import { lineLoginConfigured } from "@/server/env";
import { jsonError, readJson } from "@/server/http";

/// The LINE in-app browser posts the LIFF access token here. The token is verified with LINE
/// before any session is issued.
export async function POST(request: Request) {
  try {
    if (!lineLoginConfigured()) {
      throw new HttpError(503, "ยังไม่ได้ตั้งค่าช่องทาง LINE");
    }
    const body = await readJson<{ accessToken?: string }>(request);
    if (!body.accessToken) throw new HttpError(400, "ไม่พบ access token จาก LINE");

    const identity = await identityFromLiffAccessToken(body.accessToken).catch(() => {
      throw new HttpError(401, "ยืนยันตัวตนกับ LINE ไม่สำเร็จ");
    });
    const outcome = await signInWithLine(identity, await clientIp());
    return NextResponse.json(outcome);
  } catch (error) {
    return jsonError(error);
  }
}
