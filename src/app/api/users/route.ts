import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, HttpError, requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { generateInviteCode, hashSecret } from "@/server/auth/password";
import { PERMISSIONS, hasScopedPermission, isSystemAdmin } from "@/server/rbac";
import { jsonError, pagination, readJson } from "@/server/http";

const createSchema = z.object({
  employeeCode: z.string().trim().min(1, "ใส่รหัสพนักงาน").max(50),
  fullName: z.string().trim().min(1, "ใส่ชื่อ-นามสกุล").max(200),
  nickname: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง").optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  branchId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),
});

function requireUserAdmin(actor: Awaited<ReturnType<typeof requireActor>>) {
  if (!isSystemAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.manageUsers, {})) {
    throw new HttpError(403, "ไม่มีสิทธิ์จัดการผู้ใช้");
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    requireUserAdmin(actor);
    const url = new URL(request.url);
    const { take, skip } = pagination(url, 30, 200);
    const query = url.searchParams.get("q")?.trim();

    const where = {
      ...(url.searchParams.get("branch") ? { branchId: url.searchParams.get("branch")! } : {}),
      ...(url.searchParams.get("department")
        ? { departmentId: url.searchParams.get("department")! }
        : {}),
      ...(query
        ? {
            OR: [
              { fullName: { contains: query, mode: "insensitive" as const } },
              { employeeCode: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          status: true,
          lineUserId: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
          roles: { select: { role: { select: { key: true, name: true } } } },
        },
        orderBy: { employeeCode: "asc" },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        lineLinked: user.lineUserId !== null,
        lineUserId: undefined,
        roles: user.roles.map((grant) => grant.role),
      })),
      total,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/// Creates an employee record with a printable invite code. The plain code is returned once and
/// only the hash is stored.
export async function POST(request: Request) {
  try {
    const actor = await requireActor();
    requireUserAdmin(actor);
    const parsed = createSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "ข้อมูลไม่ครบ");
    }

    const taken = await prisma.user.findUnique({
      where: { employeeCode: parsed.data.employeeCode },
      select: { id: true },
    });
    if (taken) throw new HttpError(409, "รหัสพนักงานนี้มีอยู่แล้ว");

    const inviteCode = generateInviteCode();
    const employeeRole = await prisma.role.findUnique({
      where: { key: "employee" },
      select: { id: true },
    });

    const user = await prisma.user.create({
      data: {
        employeeCode: parsed.data.employeeCode,
        fullName: parsed.data.fullName,
        nickname: parsed.data.nickname ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        companyId: actor.companyId,
        branchId: parsed.data.branchId ?? null,
        departmentId: parsed.data.departmentId ?? null,
        positionId: parsed.data.positionId ?? null,
        status: "INVITED",
        inviteCodeHash: await hashSecret(inviteCode),
        ...(employeeRole
          ? { roles: { create: { roleId: employeeRole.id, scope: "COMPANY" as const } } }
          : {}),
      },
      select: { id: true, employeeCode: true, fullName: true },
    });

    await recordAudit({
      userId: actor.userId,
      action: AUDIT.userCreated,
      entity: "user",
      entityId: user.id,
      ipAddress: await clientIp(),
      metadata: { employeeCode: user.employeeCode },
    });

    return NextResponse.json({ ...user, inviteCode }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
