import { headers } from "next/headers";
import { currentSessionClaims } from "@/server/auth/session";
import { loadActor, type ActorContext } from "@/server/rbac";

/// Returns the signed-in employee, or null. Every route re-loads roles from the database
/// so a suspended account or a changed role takes effect on the next request.
export async function getActor(): Promise<ActorContext | null> {
  const claims = await currentSessionClaims();
  if (!claims) return null;
  return loadActor(claims.userId);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireActor(): Promise<ActorContext> {
  const actor = await getActor();
  if (!actor) throw new HttpError(401, "ต้องเข้าสู่ระบบก่อน");
  return actor;
}

export async function clientIp(): Promise<string | null> {
  const store = await headers();
  const forwarded = store.get("cf-connecting-ip") ?? store.get("x-forwarded-for");
  if (!forwarded) return null;
  return forwarded.split(",")[0]?.trim() ?? null;
}
