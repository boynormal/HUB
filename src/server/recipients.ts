import type { Prisma, TargetType } from "@prisma/client";
import { prisma } from "@/server/db";

export type TargetRule = {
  targetType: TargetType;
  targetId: string | null;
};

/// Builds the `where` clause that turns target rules into an employee set.
/// Rules are additive: an employee matched by any rule is a recipient.
export function buildRecipientWhere(rules: TargetRule[]): Prisma.UserWhereInput | null {
  if (rules.length === 0) return null;

  const base: Prisma.UserWhereInput = { status: "ACTIVE" };
  if (rules.some((rule) => rule.targetType === "ALL")) {
    return base;
  }

  const companyIds: string[] = [];
  const branchIds: string[] = [];
  const departmentIds: string[] = [];
  const positionIds: string[] = [];
  const roleIds: string[] = [];
  const userIds: string[] = [];
  const groupIds: string[] = [];

  for (const rule of rules) {
    if (!rule.targetId) continue;
    switch (rule.targetType) {
      case "COMPANY":
        companyIds.push(rule.targetId);
        break;
      case "BRANCH":
        branchIds.push(rule.targetId);
        break;
      case "DEPARTMENT":
        departmentIds.push(rule.targetId);
        break;
      case "POSITION":
        positionIds.push(rule.targetId);
        break;
      case "ROLE":
        roleIds.push(rule.targetId);
        break;
      case "USER":
        userIds.push(rule.targetId);
        break;
      case "GROUP":
        groupIds.push(rule.targetId);
        break;
      default:
        break;
    }
  }

  const clauses: Prisma.UserWhereInput[] = [];
  if (companyIds.length) clauses.push({ companyId: { in: companyIds } });
  if (branchIds.length) clauses.push({ branchId: { in: branchIds } });
  if (departmentIds.length) clauses.push({ departmentId: { in: departmentIds } });
  if (positionIds.length) clauses.push({ positionId: { in: positionIds } });
  if (roleIds.length) clauses.push({ roles: { some: { roleId: { in: roleIds } } } });
  if (userIds.length) clauses.push({ id: { in: userIds } });
  if (groupIds.length) clauses.push({ groupMemberships: { some: { groupId: { in: groupIds } } } });

  if (clauses.length === 0) return null;
  return { ...base, OR: clauses };
}

/// Effective recipients for a set of rules. Only ids are returned; no profile data is copied.
export async function resolveRecipientIds(rules: TargetRule[]): Promise<string[]> {
  const where = buildRecipientWhere(rules);
  if (!where) return [];
  const users = await prisma.user.findMany({ where, select: { id: true } });
  return users.map((user) => user.id);
}

export async function countRecipients(rules: TargetRule[]): Promise<number> {
  const where = buildRecipientWhere(rules);
  if (!where) return 0;
  return prisma.user.count({ where });
}

/// True when the employee falls inside the post's target rules. Used for read access.
export async function isRecipient(rules: TargetRule[], userId: string): Promise<boolean> {
  const where = buildRecipientWhere(rules);
  if (!where) return false;
  const found = await prisma.user.findFirst({ where: { ...where, id: userId }, select: { id: true } });
  return found !== null;
}

/// Creates the missing receipt rows for a published post. Existing rows are left alone
/// so an edited recipient list never erases an acknowledgement.
export async function syncReceipts(postId: string, recipientIds: string[]): Promise<number> {
  if (recipientIds.length === 0) return 0;
  const result = await prisma.communicationPostReceipt.createMany({
    data: recipientIds.map((userId) => ({ postId, userId })),
    skipDuplicates: true,
  });
  return result.count;
}
