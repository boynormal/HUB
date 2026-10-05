import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeeEditor } from "@/components/employee-editor";
import { prisma } from "@/server/db";
import { PERMISSIONS, hasPermission, isSystemAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requirePageActor();
  if (!isSystemAdmin(actor) && !hasPermission(actor, PERMISSIONS.manageUsers)) {
    redirect("/settings");
  }
  const { q = "" } = await searchParams;

  const [shell, users, branches, departments, positions] = await Promise.all([
    shellData(actor),
    prisma.user.findMany({
      where: q.trim()
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        status: true,
        lineUserId: true,
        branchId: true,
        departmentId: true,
        positionId: true,
      },
      orderBy: { employeeCode: "asc" },
      take: 100,
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell {...shell}>
      <nav className="mb-3 text-sm text-muted">
        <Link href="/settings" className="hover:underline">
          ← ตั้งค่าระบบ
        </Link>
      </nav>

      <h1 className="text-xl font-semibold">พนักงาน</h1>
      <p className="mt-1 text-sm text-muted">
        คนที่เข้าด้วย LINE ครั้งแรกอยู่สถานะรออนุมัติ กดอนุมัติแล้วใส่ชื่อ สาขา แผนก และตำแหน่ง
      </p>

      <form className="mt-5" role="search">
        <label className="sr-only" htmlFor="user-search">
          ค้นหาพนักงาน
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        />
      </form>

      <EmployeeEditor
        employees={users.map((user) => ({
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          status: user.status,
          lineLinked: user.lineUserId !== null,
          branchId: user.branchId,
          departmentId: user.departmentId,
          positionId: user.positionId,
        }))}
        branches={branches}
        departments={departments}
        positions={positions}
      />
    </AppShell>
  );
}
