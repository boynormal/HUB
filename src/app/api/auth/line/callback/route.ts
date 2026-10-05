import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientIp } from "@/server/auth/actor";
import { identityFromAuthorizationCode } from "@/server/auth/line";
import { signInWithLine } from "@/server/auth/account";
import {
  LINE_STATE_COOKIE,
  PENDING_LINE_COOKIE,
  appOrigin,
  cookieSecure,
  lineCallbackUrl,
} from "@/server/auth/line-flow";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = appOrigin();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const expected = store.get(LINE_STATE_COOKIE)?.value;
  store.delete(LINE_STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${origin}/signin?error=state`);
  }

  try {
    const identity = await identityFromAuthorizationCode(code, lineCallbackUrl());
    const outcome = await signInWithLine(identity, await clientIp());
    if (outcome.state === "signed_in") {
      return NextResponse.redirect(`${origin}/`);
    }
    // The LINE account is real but not linked to an employee yet.
    const response = NextResponse.redirect(`${origin}/signin/link`);
    response.cookies.set(PENDING_LINE_COOKIE, identity.lineUserId, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: 900,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${origin}/signin?error=line`);
  }
}
