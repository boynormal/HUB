import "dotenv/config";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { createQueue, QUEUES, type LineNotifyJob, type PostPublishedJob, type ReminderDueJob } from "@/server/queue";
import { fanOutPostNotifications } from "@/server/posts";
import { buildPushText, pushLineText } from "@/server/line-messaging";
import { linePushConfigured } from "@/server/env";
import {
  dueReminderIds,
  expirePosts,
  publishDueScheduledPosts,
  runReminder,
} from "@/server/reminder-runner";

/// Separate process. The web app only enqueues work, so a slow LINE push never blocks a request.
async function main() {
  const boss = createQueue(env().DATABASE_URL);
  boss.on("error", (error) => console.error("[worker] queue error", error));
  await boss.start();

  for (const queue of Object.values(QUEUES)) {
    await boss.createQueue(queue);
  }

  await boss.work<PostPublishedJob>(QUEUES.postPublished, async ([job]) => {
    const count = await fanOutPostNotifications(job.data.postId);
    console.log(`[worker] post-published ${job.data.postId} → ${count} การแจ้งเตือน`);
  });

  await boss.work<ReminderDueJob>(QUEUES.reminderDue, async ([job]) => {
    await runReminder(job.data.reminderId);
    console.log(`[worker] reminder ${job.data.reminderId} ส่งแล้ว`);
  });

  await boss.work<LineNotifyJob>(QUEUES.lineNotify, async ([job]) => {
    await sendLineNotification(job.data.notificationId);
  });

  // The tick does the time-based work: due reminders, scheduled posts and expiry.
  await boss.work(QUEUES.scheduleTick, async () => {
    await tick();
  });

  await boss.schedule(QUEUES.scheduleTick, "*/5 * * * *");
  console.log("[worker] พร้อมทำงาน");

  // Runs once at start so a restart never waits five minutes to catch up.
  await tick();

  const shutdown = async () => {
    console.log("[worker] กำลังปิด");
    await boss.stop();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function tick(): Promise<void> {
  const published = await publishDueScheduledPosts();
  if (published.length > 0) console.log(`[worker] เผยแพร่ตามเวลา ${published.length} ประกาศ`);

  const expired = await expirePosts();
  if (expired > 0) console.log(`[worker] หมดอายุ ${expired} ประกาศ`);

  const reminders = await dueReminderIds();
  for (const reminderId of reminders) {
    await runReminder(reminderId);
  }
  if (reminders.length > 0) console.log(`[worker] ส่งเตือน ${reminders.length} รายการ`);

  await sendPendingLineNotifications();
}

/// LINE rows are sent from here, so a push failure is recorded and retried on the next tick
/// instead of being lost.
async function sendPendingLineNotifications(limit = 100): Promise<void> {
  if (!linePushConfigured()) return;
  const pending = await prisma.communicationNotification.findMany({
    where: { channel: "LINE", sentAt: null },
    select: { id: true },
    take: limit,
  });
  for (const row of pending) {
    await sendLineNotification(row.id);
  }
}

async function sendLineNotification(notificationId: string): Promise<void> {
  const notification = await prisma.communicationNotification.findUnique({
    where: { id: notificationId },
    select: {
      id: true,
      title: true,
      body: true,
      linkPath: true,
      sentAt: true,
      user: { select: { lineUserId: true } },
    },
  });
  if (!notification || notification.sentAt) return;
  const lineUserId = notification.user.lineUserId;
  if (!lineUserId) {
    await prisma.communicationNotification.update({
      where: { id: notification.id },
      data: { error: "ยังไม่ผูกบัญชี LINE" },
    });
    return;
  }
  if (!linePushConfigured()) return;

  try {
    await pushLineText(
      lineUserId,
      buildPushText(notification.title, notification.body, notification.linkPath),
    );
    await prisma.communicationNotification.update({
      where: { id: notification.id },
      data: { sentAt: new Date(), error: null },
    });
  } catch (error) {
    await prisma.communicationNotification.update({
      where: { id: notification.id },
      data: { error: error instanceof Error ? error.message.slice(0, 500) : "push failed" },
    });
    throw error;
  }
}

main().catch(async (error) => {
  console.error("[worker] เริ่มทำงานไม่สำเร็จ", error);
  await prisma.$disconnect();
  process.exit(1);
});
