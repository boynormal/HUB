import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RestorePostButton } from "@/components/restore-post-button";
import { prisma } from "@/server/db";
import { AUDIT } from "@/server/audit";
import { isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

export default async function DeletedPostsPage() {
  const actor = await requirePageActor();
  if (!isCommunicationAdmin(actor)) redirect("/settings");

  const [shell, posts] = await Promise.all([
    shellData(actor),
    prisma.communicationPost.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, title: true, deletedAt: true, topic: { select: { name: true } } },
      orderBy: { deletedAt: "desc" },
      take: 100,
    }),
  ]);

  const logs = await prisma.communicationAuditLog.findMany({
    where: {
      entity: "post",
      entityId: { in: posts.map((post) => post.id) },
      action: AUDIT.postUpdated,
    },
    orderBy: { createdAt: "desc" },
    select: { entityId: true, metadata: true, user: { select: { fullName: true } } },
  });
  const deletedBy = new Map<string, string>();
  for (const log of logs) {
    if (!log.entityId || deletedBy.has(log.entityId)) continue;
    const metadata = log.metadata as { softDeleted?: boolean } | null;
    if (!metadata?.softDeleted) continue;
    deletedBy.set(log.entityId, log.user?.fullName ?? "ไม่ทราบ");
  }

  return (
    <AppShell {...shell}>
      <nav className="mb-3 text-sm text-muted">
        <Link href="/settings" className="hover:underline">
          ← ตั้งค่าระบบ
        </Link>
      </nav>
      <h1 className="text-xl font-semibold">ประกาศที่ลบแล้ว</h1>
      <p className="mt-1 text-sm text-muted">เปิดอ่านเนื้อหาเดิมได้ และนำกลับไปแสดงในฟีดได้</p>

      {posts.length === 0 ? (
        <p className="hub-card mt-4 p-4 text-sm text-muted">ยังไม่มีประกาศที่ลบ</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {posts.map((post) => (
            <li key={post.id} className="hub-card flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/posts/${post.id}`} className="font-medium hover:underline">
                  {post.title}
                </Link>
                <p className="text-xs text-muted">
                  {post.topic.name} · ลบเมื่อ {post.deletedAt ? formatThaiDateTime(post.deletedAt) : "—"} ·{" "}
                  {deletedBy.get(post.id) ?? "ไม่ทราบผู้ลบ"}
                </p>
              </div>
              <RestorePostButton postId={post.id} compact />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
