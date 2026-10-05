import { env } from "@/server/env";

export const LINE_STATE_COOKIE = "hub_line_state";
/// Holds a verified LINE id between the callback and the link screen, so the link step never
/// trusts a LINE user id sent by the browser.
export const PENDING_LINE_COOKIE = "hub_pending_line";

export function lineCallbackUrl(): string {
  return `${appOrigin()}/api/auth/line/callback`;
}

export function appOrigin(): string {
  return env().APP_ORIGIN.replace(/\/$/, "");
}

export function cookieSecure(): boolean {
  return appOrigin().startsWith("https://");
}
