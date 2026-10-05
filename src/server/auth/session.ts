import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";

export const SESSION_COOKIE = "hub_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionClaims = {
  userId: string;
  employeeCode: string;
  fullName: string;
};

function key(): Uint8Array {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      employeeCode: String(payload.employeeCode ?? ""),
      fullName: String(payload.fullName ?? ""),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(claims: SessionClaims): Promise<void> {
  const token = await createSessionToken(claims);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_ORIGIN.startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function currentSessionClaims(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}
