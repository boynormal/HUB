import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MarkAllRead } from "@/components/mark-all-read";
import { prisma } from "@/server/db";
import { requirePageActor, shellData } from "@/server/shell";
import { formatRelativeThai } from "@/server/time";

type SearchParams = Promise<{ filter?: string }>;

const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "unread", label: "ยังไม่อ่าน" },
  { key: "confirmation", label: "ต้องรับทราบ" },
  { key: "urgent", label: "ด่วน" },
];

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageActor();
  const { filter = "all" } = await searchParams;
  const shell = await shellData(actor);

  const notifications = await prisma.communicationNotification.findMany({
    where: {
      userId: actor.userId,
      channel: "IN_APP",
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(filter === "urgent" ? { isUrgent: true } : {}),
      ...(filter === "confirmation"
        ? { type: { in: ["CONFIRMATION_REQUIRED", "CONFIRMATION_REMINDER", "DEADLINE"] } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      linkPath: true,
      isUrgent: true,
      readAt: true,
      createdAt: true,
    },
  });

  return (
    <AppShell {...shell}>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">แจ้งเตือน</h1>
        {shell.unreadNotifications > 0 ? <MarkAllRead /> : null}
      </div>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="ตัวกรองแจ้งเตือน">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? "/notifications" : `/notifications?filter=${item.key}`}
            aria-current={filter === item.key ? "page" : undefined}
            className={`thumb-zone inline-flex shrink-0 items-center rounded-lg border px-4 text-sm font-medium ${
              filter === item.key
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {notifications.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          ยังไม่มีแจ้งเตือน
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notifications.map((item) => (
            <li key={item.id}>
              <Link
                href={item.linkPath ?? "/"}
                className={`block rounded-xl border p-3 ${
                  item.readAt === null ? "border-accent bg-accent-soft" : "border-line bg-surface"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span aria-hidden="true">{item.isUrgent ? "❗" : "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.title}</span>
                    {item.body ? (
                      <span className="mt-0.5 block line-clamp-2 text-sm text-muted">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted">
                      {formatRelativeThai(item.createdAt)}
                      {item.readAt === null ? " · ยังไม่อ่าน" : ""}
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
