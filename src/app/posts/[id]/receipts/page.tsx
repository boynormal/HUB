import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RemindButton } from "@/components/remind-button";
import { prisma } from "@/server/db";
import { canManagePostRecord } from "@/server/posts";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

export default async function ReceiptsPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;

  const post = await prisma.communicationPost.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      title: true,
      topicId: true,
      authorId: true,
      requiresConfirmation: true,
      confirmationDeadline: true,
    },
  });
  if (!post) notFound();

  const allowed =
    isCommunicationAdmin(actor) ||
    canManagePostRecord(actor, post) ||
    hasScopedPermission(actor, PERMISSIONS.viewReports, { topicId: post.topicId });
  if (!allowed) notFound();

  const [shell, receipts] = await Promise.all([
    shellData(actor),
    prisma.communicationPostReceipt.findMany({
      where: { postId: id },
      select: {
        id: true,
        readAt: true,
        acknowledgedAt: true,
        acknowledgeNote: true,
        user: {
          select: {
            fullName: true,
            employeeCode: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ acknowledgedAt: "asc" }, { user: { fullName: "asc" } }],
      take: 500,
    }),
  ]);

  const acknowledged = receipts.filter((receipt) => receipt.acknowledgedAt !== null).length;
  const read = receipts.filter((receipt) => receipt.readAt !== null).length;
  const pending = receipts.length - acknowledged;

  return (
    <AppShell {...shell}>
      <nav className="mb-3 text-sm text-muted">
        <Link href={`/posts/${post.id}`} className="hover:underline">
          ← กลับไปที่ประกาศ
        </Link>
      </nav>

      <h1 className="text-xl font-semibold">รายชื่อผู้รับ</h1>
      <p className="mt-1 text-sm text-muted">{post.title}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ส่งถึง" value={receipts.length} />
        <Stat label="อ่านแล้ว" value={read} />
        <Stat label="รับทราบแล้ว" value={acknowledged} />
        <Stat label="ยังไม่รับทราบ" value={pending} tone={pending > 0 ? "text-danger" : undefined} />
      </div>

      {post.requiresConfirmation && pending > 0 ? (
        <div className="mt-4">
          <RemindButton postId={post.id} pending={pending} />
        </div>
      ) : null}

      <div className="data-table mt-5">
        <table className="w-full text-sm">
          <caption className="sr-only">สถานะการอ่านและรับทราบของผู้รับแต่ละคน</caption>
          <thead className="bg-surface-muted text-start">
            <tr>
              <th className="px-3 py-2 text-start font-medium">พนักงาน</th>
              <th className="px-3 py-2 text-start font-medium">แผนก</th>
              <th className="px-3 py-2 text-start font-medium">อ่าน</th>
              <th className="px-3 py-2 text-start font-medium">รับทราบ</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <span className="block font-medium">{receipt.user.fullName}</span>
                  <span className="block text-xs text-muted">{receipt.user.employeeCode}</span>
                </td>
                <td className="px-3 py-2 text-muted">
                  {receipt.user.department?.name ?? "—"}
                  {receipt.user.branch?.name ? ` · ${receipt.user.branch.name}` : ""}
                </td>
                <td className="px-3 py-2 text-muted">
                  {receipt.readAt ? formatThaiDateTime(receipt.readAt) : "ยังไม่อ่าน"}
                </td>
                <td className="px-3 py-2">
                  {receipt.acknowledgedAt ? (
                    <span className="text-success">
                      ✓ {formatThaiDateTime(receipt.acknowledgedAt)}
                      {receipt.acknowledgeNote ? (
                        <span className="block text-xs text-muted">{receipt.acknowledgeNote}</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-danger">ยังไม่รับทราบ</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-semibold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
