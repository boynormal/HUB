import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import { verifySecret } from "@/server/auth/password";
import { setSessionCookie } from "@/server/auth/session";
import type { LineIdentity } from "@/server/auth/line";

export type SignInOutcome =
  | { state: "signed_in"; userId: string; fullName: string }
  | { state: "pending"; userId: string; fullName: string };

async function issueSession(user: {
  id: string;
  employeeCode: string;
  fullName: string;
}): Promise<void> {
  await setSessionCookie({
    userId: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
}

/// A known LINE account signs in. A new one is created as INVITED and waits for an admin.
export async function signInWithLine(
  identity: LineIdentity,
  ip: string | null,
): Promise<SignInOutcome> {
  let user = await prisma.user.findUnique({
    where: { lineUserId: identity.lineUserId },
    select: { id: true, employeeCode: true, fullName: true, status: true, avatarUrl: true },
  });

  if (!user) {
    user = await createInvitedLineUser(identity, ip);
  }
  if (user.status === "SUSPENDED") {
    await recordAudit({
      userId: user.id,
      action: AUDIT.loginFailed,
      entity: "user",
      entityId: user.id,
      ipAddress: ip,
      metadata: { reason: "suspended" },
    });
    throw new HttpError(403, "บัญชีนี้ถูกระงับการใช้งาน ติดต่อฝ่ายบุคคล");
  }

  if (identity.pictureUrl && identity.pictureUrl !== user.avatarUrl) {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: identity.pictureUrl },
    });
  }

  await issueSession(user);
  await recordAudit({
    userId: user.id,
    action: AUDIT.loginSucceeded,
    entity: "user",
    entityId: user.id,
    ipAddress: ip,
    metadata: { method: "line" },
  });
  if (user.status === "INVITED") {
    return { state: "pending", userId: user.id, fullName: user.fullName };
  }
  return { state: "signed_in", userId: user.id, fullName: user.fullName };
}

async function createInvitedLineUser(identity: LineIdentity, ip: string | null) {
  const company = await prisma.company.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!company) throw new HttpError(503, "ยังไม่ได้ตั้งค่าบริษัท");

  const fullName = identity.displayName?.trim() || "ผู้ใช้ LINE";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await prisma.user.create({
        data: {
          employeeCode: `line-${randomBytes(4).toString("hex")}`,
          fullName,
          companyId: company.id,
          status: "INVITED",
          lineUserId: identity.lineUserId,
          lineLinkedAt: new Date(),
          avatarUrl: identity.pictureUrl,
        },
        select: { id: true, employeeCode: true, fullName: true, status: true, avatarUrl: true },
      });
      await ensureEmployeeRole(created.id);
      await recordAudit({
        userId: created.id,
        action: AUDIT.userCreated,
        entity: "user",
        entityId: created.id,
        ipAddress: ip,
        metadata: { source: "line", employeeCode: created.employeeCode },
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await prisma.user.findUnique({
          where: { lineUserId: identity.lineUserId },
          select: { id: true, employeeCode: true, fullName: true, status: true, avatarUrl: true },
        });
        if (existing) return existing;
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(500, "สร้างบัญชีจาก LINE ไม่สำเร็จ");
}

/// Links a LINE account to an employee record using the employee code and the printed invite code.
export async function linkLineAccount(
  input: { employeeCode: string; inviteCode: string; identity: LineIdentity },
  ip: string | null,
): Promise<{ userId: string; fullName: string }> {
  const employeeCode = input.employeeCode.trim();
  const inviteCode = input.inviteCode.trim().toUpperCase();
  const user = await prisma.user.findUnique({ where: { employeeCode } });

  const reject = async (reason: string) => {
    await recordAudit({
      userId: user?.id ?? null,
      action: AUDIT.loginFailed,
      entity: "user",
      entityId: user?.id ?? null,
      ipAddress: ip,
      metadata: { reason, employeeCode },
    });
    throw new HttpError(400, "รหัสพนักงานหรือรหัสเชิญไม่ถูกต้อง");
  };

  if (!user) return reject("unknown_employee_code") as never;
  if (user.status === "SUSPENDED") throw new HttpError(403, "บัญชีนี้ถูกระงับการใช้งาน");
  if (user.lineUserId && user.lineUserId !== input.identity.lineUserId) {
    throw new HttpError(409, "รหัสพนักงานนี้ผูกกับบัญชี LINE อื่นแล้ว ติดต่อผู้ดูแลระบบ");
  }
  if (!(await verifySecret(inviteCode, user.inviteCodeHash))) return reject("bad_invite_code") as never;

  const taken = await prisma.user.findUnique({
    where: { lineUserId: input.identity.lineUserId },
    select: { id: true },
  });
  if (taken && taken.id !== user.id) {
    throw new HttpError(409, "บัญชี LINE นี้ผูกกับพนักงานคนอื่นแล้ว");
  }

  const linked = await prisma.user.update({
    where: { id: user.id },
    data: {
      lineUserId: input.identity.lineUserId,
      lineLinkedAt: new Date(),
      status: "ACTIVE",
      // The invite code is single use.
      inviteCodeHash: null,
      avatarUrl: input.identity.pictureUrl ?? user.avatarUrl,
    },
    select: { id: true, employeeCode: true, fullName: true },
  });

  await ensureEmployeeRole(linked.id);
  await issueSession(linked);
  await recordAudit({
    userId: linked.id,
    action: AUDIT.lineLinked,
    entity: "user",
    entityId: linked.id,
    ipAddress: ip,
    metadata: { employeeCode },
  });
  return { userId: linked.id, fullName: linked.fullName };
}

/// Password sign-in exists for System Admin accounts so the system can be set up before LINE is ready.
export async function signInWithPassword(
  input: { employeeCode: string; password: string },
  ip: string | null,
): Promise<{ userId: string; fullName: string }> {
  const user = await prisma.user.findUnique({
    where: { employeeCode: input.employeeCode.trim() },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      status: true,
      passwordHash: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });

  const fail = async (reason: string) => {
    await recordAudit({
      userId: user?.id ?? null,
      action: AUDIT.loginFailed,
      entity: "user",
      entityId: user?.id ?? null,
      ipAddress: ip,
      metadata: { reason, employeeCode: input.employeeCode },
    });
    throw new HttpError(401, "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง");
  };

  if (!user || !user.passwordHash) return fail("no_password") as never;
  if (user.status !== "ACTIVE") return fail("inactive") as never;
  if (!(await verifySecret(input.password, user.passwordHash))) return fail("bad_password") as never;
  const isAdmin = user.roles.some((grant) =>
    ["system_admin", "communication_admin"].includes(grant.role.key),
  );
  if (!isAdmin) return fail("not_admin") as never;

  await issueSession(user);
  await recordAudit({
    userId: user.id,
    action: AUDIT.loginSucceeded,
    entity: "user",
    entityId: user.id,
    ipAddress: ip,
    metadata: { method: "password" },
  });
  return { userId: user.id, fullName: user.fullName };
}

/// Every employee holds the employee role, so a linked account can read its feed immediately.
export async function ensureEmployeeRole(userId: string): Promise<void> {
  const role = await prisma.role.findUnique({ where: { key: "employee" }, select: { id: true } });
  if (!role) return;
  const existing = await prisma.userRole.findFirst({
    where: { userId, roleId: role.id, scope: "COMPANY" },
    select: { id: true },
  });
  if (existing) return;
  await prisma.userRole.create({ data: { userId, roleId: role.id, scope: "COMPANY" } });
}
