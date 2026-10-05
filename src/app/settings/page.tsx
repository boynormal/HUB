import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/server/db";
import { isCommunicationAdmin, isSystemAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function SettingsPage() {
  const actor = await requirePageActor();
  if (!isCommunicationAdmin(actor)) redirect("/settings/me");

  const [shell, counts] = await Promise.all([
    shellData(actor),
    Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { lineUserId: { not: null } } }),
      prisma.communicationTopic.count({ where: { isActive: true } }),
      prisma.communicationTag.count({ where: { isActive: true } }),
      prisma.communicationPost.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
      prisma.communicationPost.count({ where: { deletedAt: null, status: "SCHEDULED" } }),
      prisma.communicationPost.count({ where: { deletedAt: { not: null } } }),
    ]),
  ]);
  const [users, active, lineLinked, topics, tags, published, scheduled, deleted] = counts;

  const links = [
    { href: "/settings/users", label: "พนักงาน", hint: `${users} คน` },
    { href: "/settings/departments", label: "ผู้จัดการแผนก", hint: "หนึ่งคนต่อแผนก" },
    { href: "/settings/topics", label: "หัวข้อ", hint: `${topics} หัวข้อ` },
    { href: "/settings/tags", label: "แท็ก", hint: `${tags} แท็ก` },
    { href: "/settings/deleted", label: "ประกาศที่ลบแล้ว", hint: `${deleted} รายการ` },
    { href: "/reports", label: "รายงานการรับทราบ", hint: "" },
    ...(isSystemAdmin(actor)
      ? [{ href: "/settings/audit", label: "บันทึกการใช้งาน", hint: "เฉพาะผู้ดูแลระบบ" }]
      : []),
  ];

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">ตั้งค่าระบบ</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="พนักงานที่ใช้งาน" value={active} />
        <Stat label="ผูก LINE แล้ว" value={lineLinked} />
        <Stat label="ประกาศที่เผยแพร่" value={published} />
        <Stat label="ตั้งเวลารออยู่" value={scheduled} />
      </div>

      <ul className="mt-5 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="thumb-zone flex items-center gap-3 rounded-xl border border-line bg-surface px-4 text-sm font-medium"
            >
              <span className="flex-1">{link.label}</span>
              <span className="text-xs text-muted">{link.hint}</span>
              <span aria-hidden="true" className="text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
