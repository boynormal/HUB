import PgBoss from "pg-boss";

export const QUEUES = {
  postPublished: "post-published",
  reminderDue: "reminder-due",
  scheduleTick: "schedule-tick",
  lineNotify: "line-notify",
} as const;

export type PostPublishedJob = { postId: string };
export type ReminderDueJob = { reminderId: string };
export type LineNotifyJob = { notificationId: string };

/// pg-boss keeps its own tables in schema `pgboss` so Prisma never manages them.
export function createQueue(connectionString: string): PgBoss {
  return new PgBoss({ connectionString, schema: "pgboss" });
}

let publisher: PgBoss | null = null;

/// The web app only publishes jobs. A separate worker process consumes them,
/// so a publish request never sends notifications inside the HTTP request.
export async function getPublisher(connectionString: string): Promise<PgBoss | null> {
  if (publisher) return publisher;
  try {
    const boss = createQueue(connectionString);
    boss.on("error", (error) => {
      console.error("[queue] error", error);
    });
    await boss.start();
    publisher = boss;
    return publisher;
  } catch (error) {
    console.error("[queue] unavailable, falling back to inline processing", error);
    return null;
  }
}
