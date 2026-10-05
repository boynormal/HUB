import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { prisma } from "@/server/db";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

const ROLE_LABEL: Record<string, string> = {
  employee: "พนักงาน",
  topic_manager: "ผู้ดูแลหัวข้อ",
  communication_admin: "ผู้ดูแลการสื่อสาร",
  system_admin: "ผู้ดูแลระบบ",
};

export default async function MyProfilePage() {
  const actor = await requirePageActor();
  const [shell, user] = await Promise.all([
    shellData(actor),
    prisma.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: { lineLinkedAt: true, lastLoginAt: true, status: true },
    }),
  ]);

  const rows = [
    { label: "ชื่อ", value: actor.fullName },
    { label: "รหัสพนักงาน", value: actor.employeeCode },
    { label: "สาขา", value: actor.branchName ?? "—" },
    { label: "แผนก", value: actor.departmentName ?? "—" },
    { label: "ตำแหน่ง", value: actor.positionName ?? "—" },
    {
      label: "บทบาท",
      value: actor.roleKeys.map((key) => ROLE_LABEL[key] ?? key).join(", ") || "—",
    },
    {
      label: "ผูก LINE",
      value: user.lineLinkedAt ? `ผูกแล้ว ${formatThaiDateTime(user.lineLinkedAt)}` : "ยังไม่ผูก",
    },
    { label: "เข้าใช้งานล่าสุด", value: formatThaiDateTime(user.lastLoginAt) || "—" },
  ];

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">ข้อมูลของฉัน</h1>

      <dl className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3 border-b border-line py-2 last:border-b-0">
            <dt className="w-32 shrink-0 text-muted">{row.label}</dt>
            <dd className="flex-1 font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">ธีม</h2>
        <p className="mt-1 text-sm text-muted">
          เริ่มต้นตามการตั้งค่าของเครื่อง เปลี่ยนได้ที่ปุ่มนี้และจำไว้ในเบราว์เซอร์นี้
        </p>
        <div className="mt-2">
          <ThemeToggle />
        </div>
      </section>

      <div className="mt-4">
        <SignOutButton />
      </div>
    </AppShell>
  );
}
