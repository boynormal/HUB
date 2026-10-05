import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TopicEditor } from "@/components/topic-editor";
import { prisma } from "@/server/db";
import { isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function TopicSettingsPage() {
  const actor = await requirePageActor();
  if (!isCommunicationAdmin(actor)) redirect("/settings");

  const [shell, topics] = await Promise.all([
    shellData(actor),
    prisma.communicationTopic.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        isActive: true,
        maxPinned: true,
        _count: { select: { posts: true } },
      },
    }),
  ]);

  return (
    <AppShell {...shell}>
      <nav className="mb-3 text-sm text-muted">
        <Link href="/settings" className="hover:underline">
          ← ตั้งค่าระบบ
        </Link>
      </nav>

      <div className="inline-flex rounded-full border border-line bg-surface p-1">
        <Link
          href="/settings/topics"
          aria-current="page"
          className="thumb-zone inline-flex items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          หัวข้อ
        </Link>
        <Link href="/settings/tags" className="thumb-zone inline-flex items-center rounded-full px-4 text-sm font-medium">
          แท็ก
        </Link>
      </div>
      <h1 className="mt-4 text-xl font-semibold">หัวข้อ</h1>
      <p className="mt-1 text-sm text-muted">ใส่ชื่อแล้วเพิ่ม กดแก้ไขบนการ์ดเมื่อต้องการเปลี่ยนสีหรือสถานะ</p>

      <TopicEditor
        topics={topics.map((topic) => ({
          id: topic.id,
          name: topic.name,
          color: topic.color,
          isActive: topic.isActive,
          maxPinned: topic.maxPinned,
          posts: topic._count.posts,
        }))}
      />
    </AppShell>
  );
}
