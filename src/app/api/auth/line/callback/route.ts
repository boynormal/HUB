import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clientIp } from "@/server/auth/actor";
import { identityFromAuthorizationCode } from "@/server/auth/line";
import { signInWithLine } from "@/server/auth/account";
import { LINE_STATE_COOKIE, appOrigin, lineCallbackUrl } from "@/server/auth/line-flow";

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
    const next = outcome.state === "pending" ? "/signin/pending" : "/";
    return NextResponse.redirect(`${origin}${next}`);
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${origin}/signin?error=line`);
  }
}
