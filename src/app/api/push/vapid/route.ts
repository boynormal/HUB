import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { env, phoneAlertsConfigured } from "@/server/env";
import { jsonError } from "@/server/http";

export async function GET() {
  try {
    await requireActor();
    if (!phoneAlertsConfigured()) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({ configured: true, publicKey: env().VAPID_PUBLIC_KEY });
  } catch (error) {
    return jsonError(error);
  }
}
