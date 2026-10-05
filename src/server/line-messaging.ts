import { env, linePushConfigured } from "@/server/env";

export type PushResult = { sent: boolean; error?: string };

/// Sends one text message through the company Official Account.
/// The employee must be a friend of the OA first; LINE returns an error otherwise.
export async function pushLineText(lineUserId: string, text: string): Promise<PushResult> {
  if (!linePushConfigured()) {
    return { sent: false, error: "LINE_MESSAGING_TOKEN ยังไม่ได้ตั้งค่า" };
  }
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env().LINE_MESSAGING_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: text.slice(0, 4900) }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { sent: false, error: `LINE ${response.status}: ${body.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "unknown push error" };
  }
}

export function buildPushText(title: string, body: string | null, linkPath: string | null): string {
  const lines = [title];
  if (body) lines.push("", body);
  if (linkPath) lines.push("", `${env().APP_ORIGIN}${linkPath}`);
  return lines.join("\n");
}
