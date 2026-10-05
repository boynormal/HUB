import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/server/db";
import { isSystemAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

const ACTION_LABEL: Record<string, string> = {
  post_created: "สร้างประกาศ",
  post_updated: "แก้ไขประกาศ",
  post_published: "เผยแพร่ประกาศ",
  post_scheduled: "ตั้งเวลาประกาศ",
  post_archived: "เก็บประกาศ",
  post_pinned: "ปักหมุด",
  post_read: "อ่านประกาศ",
  post_acknowledged: "กดรับทราบ",
  comment_created: "แสดงความคิดเห็น",
  comment_deleted: "ลบความคิดเห็น",
  file_uploaded: "อัปโหลดไฟล์",
  file_downloaded: "ดาวน์โหลดไฟล์",
  user_created: "สร้างผู้ใช้",
  line_linked: "ผูกบัญชี LINE",
  login_succeeded: "เข้าสู่ระบบ",
  login_failed: "เข้าสู่ระบบไม่สำเร็จ",
  reminder_sent: "ส่งเตือน",
};

export default async function AuditPage() {
  const actor = await requirePageActor();
  if (!isSystemAdmin(actor)) redirect("/settings");

  const [shell, rows] = await Promise.all([
    shellData(actor),
    prisma.communicationAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { fullName: true, employeeCode: true } },
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

      <h1 className="text-xl font-semibold">บันทึกการใช้งาน</h1>
      <p className="mt-1 text-sm text-muted">
        บันทึกนี้เพิ่มได้เท่านั้น ไม่มีการแก้ไขหรือลบ แสดง 100 รายการล่าสุด
      </p>

      <div className="data-table mt-4">
        <table className="w-full text-sm">
          <caption className="sr-only">บันทึกการใช้งานล่าสุด</caption>
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-3 py-2 text-start font-medium">เวลา</th>
              <th className="px-3 py-2 text-start font-medium">ผู้ใช้</th>
              <th className="px-3 py-2 text-start font-medium">การทำงาน</th>
              <th className="px-3 py-2 text-start font-medium">เป้าหมาย</th>
              <th className="px-3 py-2 text-start font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="whitespace-nowrap px-3 py-2 text-muted">
                  {formatThaiDateTime(row.createdAt)}
                </td>
                <td className="px-3 py-2">
                  {row.user ? `${row.user.fullName} (${row.user.employeeCode})` : "ระบบ"}
                </td>
                <td className="px-3 py-2">{ACTION_LABEL[row.action] ?? row.action}</td>
                <td className="px-3 py-2 text-muted">
                  {row.entity}
                  {row.entityId ? (
                    <span className="block text-xs">{row.entityId.slice(0, 8)}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted">{row.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
