import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { buildAuthorizeUrl } from "@/server/auth/line";
import {
  LINE_STATE_COOKIE,
  appOrigin,
  cookieSecure,
  lineCallbackUrl,
} from "@/server/auth/line-flow";
import { lineLoginConfigured } from "@/server/env";

/// Desktop browsers go through LINE Login. The state value is kept in a short-lived cookie and
/// compared on the way back, so a forged callback cannot create a session.
export async function GET() {
  if (!lineLoginConfigured()) {
    return NextResponse.redirect(`${appOrigin()}/signin?error=line_not_configured`);
  }
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(LINE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(buildAuthorizeUrl(state, nonce, lineCallbackUrl()));
}
