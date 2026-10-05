import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DepartmentManagerForm } from "@/components/department-manager-form";
import { prisma } from "@/server/db";
import { isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function DepartmentManagersPage() {
  const actor = await requirePageActor();
  if (!isCommunicationAdmin(actor)) redirect("/settings");

  const [shell, departments, people] = await Promise.all([
    shellData(actor),
    prisma.department.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: { id: true, name: true, managerUserId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { companyId: actor.companyId, status: "ACTIVE" },
      select: { id: true, fullName: true, employeeCode: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <AppShell {...shell}>
      <nav className="mb-3 text-sm text-muted">
        <Link href="/settings" className="hover:underline">
          ← ตั้งค่าระบบ
        </Link>
      </nav>
      <h1 className="text-xl font-semibold">ผู้จัดการแผนก</h1>
      <p className="mt-1 text-sm text-muted">
        แต่ละแผนกมีผู้จัดการได้หนึ่งคน คนนี้จะได้รับสรุปเมื่อพนักงานในแผนกยังไม่กดรับทราบตามกำหนด
      </p>
      <DepartmentManagerForm departments={departments} people={people} />
    </AppShell>
  );
}
