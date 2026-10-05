import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TagEditor } from "@/components/tag-editor";
import { prisma } from "@/server/db";
import { isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function TagSettingsPage() {
  const actor = await requirePageActor();
  if (!isCommunicationAdmin(actor)) redirect("/settings");

  const [shell, tags] = await Promise.all([
    shellData(actor),
    prisma.communicationTag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, isActive: true, _count: { select: { posts: true } } },
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
        <Link href="/settings/topics" className="thumb-zone inline-flex items-center rounded-full px-4 text-sm font-medium">
          หัวข้อ
        </Link>
        <Link
          href="/settings/tags"
          aria-current="page"
          className="thumb-zone inline-flex items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          แท็ก
        </Link>
      </div>
      <h1 className="mt-4 text-xl font-semibold">แท็ก</h1>
      <p className="mt-1 text-sm text-muted">ใส่ชื่อแล้วเพิ่ม กดแก้ไขบนการ์ดเมื่อต้องการเปลี่ยนชื่อหรือปิดใช้</p>

      <TagEditor
        tags={tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          isActive: tag.isActive,
          posts: tag._count.posts,
        }))}
      />
    </AppShell>
  );
}
