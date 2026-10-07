import webpush from "web-push";
import { prisma } from "@/server/db";
import { env, phoneAlertsConfigured } from "@/server/env";

type PhoneAlert = {
  userId: string;
  title: string;
  body?: string | null;
  linkPath?: string | null;
};

let vapidReady = false;

function ensureVapid(): void {
  if (vapidReady) return;
  const current = env();
  const subject = current.VAPID_SUBJECT.length > 0 ? current.VAPID_SUBJECT : current.APP_ORIGIN;
  webpush.setVapidDetails(subject, current.VAPID_PUBLIC_KEY, current.VAPID_PRIVATE_KEY);
  vapidReady = true;
}

/// Sends a lock-screen alert to each saved phone. A failed send never removes the in-app row.
export async function deliverPhoneAlerts(drafts: PhoneAlert[]): Promise<void> {
  if (!phoneAlertsConfigured() || drafts.length === 0) return;
  ensureVapid();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: [...new Set(drafts.map((draft) => draft.userId))] } },
  });
  const byUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const list = byUser.get(subscription.userId) ?? [];
    list.push(subscription);
    byUser.set(subscription.userId, list);
  }

  await Promise.all(
    drafts.flatMap((draft) =>
      (byUser.get(draft.userId) ?? []).map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              title: draft.title,
              body: draft.body ?? "",
              url: draft.linkPath || "/notifications",
            }),
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
            return;
          }
          console.error("phone alert failed", error);
        }
      }),
    ),
  );
}
