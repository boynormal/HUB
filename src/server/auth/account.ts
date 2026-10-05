import { prisma } from "@/server/db";
import { AUDIT, recordAudit } from "@/server/audit";
import { HttpError } from "@/server/auth/actor";
import { verifySecret } from "@/server/auth/password";
import { setSessionCookie } from "@/server/auth/session";
import type { LineIdentity } from "@/server/auth/line";

export type SignInOutcome =
  | { state: "signed_in"; userId: string; fullName: string }
  | { state: "needs_link"; lineUserId: string; displayName: string | null };

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

/// A LINE account that is already linked signs in. An unknown account is sent to the link screen
/// instead of being created, because employees are only ever created by an admin.
export async function signInWithLine(
  identity: LineIdentity,
  ip: string | null,
): Promise<SignInOutcome> {
  const user = await prisma.user.findUnique({
    where: { lineUserId: identity.lineUserId },
    select: { id: true, employeeCode: true, fullName: true, status: true, avatarUrl: true },
  });

  if (!user) {
    return {
      state: "needs_link",
      lineUserId: identity.lineUserId,
      displayName: identity.displayName,
    };
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
  return { state: "signed_in", userId: user.id, fullName: user.fullName };
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
