import { PermissionScope } from "@prisma/client";
import { prisma } from "@/server/db";

export const PERMISSIONS = {
  view: "communication.view",
  create: "communication.create",
  edit: "communication.edit",
  publish: "communication.publish",
  archive: "communication.archive",
  delete: "communication.delete",
  manageTopics: "communication.manage_topics",
  manageTags: "communication.manage_tags",
  manageRecipients: "communication.manage_recipients",
  viewReports: "communication.view_reports",
  manageTraining: "communication.manage_training",
  managePolls: "communication.manage_polls",
  moderate: "communication.moderate",
  manageSettings: "communication.manage_settings",
  manageUsers: "communication.manage_users",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_KEYS = {
  employee: "employee",
  topicManager: "topic_manager",
  communicationAdmin: "communication_admin",
  systemAdmin: "system_admin",
} as const;

export type GrantedPermission = {
  key: string;
  scope: PermissionScope;
  branchId: string | null;
  departmentId: string | null;
  topicId: string | null;
};

export type ActorContext = {
  userId: string;
  employeeCode: string;
  fullName: string;
  nickname: string | null;
  avatarUrl: string | null;
  companyId: string;
  branchId: string | null;
  departmentId: string | null;
  positionId: string | null;
  branchName: string | null;
  departmentName: string | null;
  positionName: string | null;
  roleKeys: string[];
  permissions: GrantedPermission[];
  managedDepartmentIds: string[];
  managedTopicIds: string[];
};

export async function loadActor(userId: string): Promise<ActorContext | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
      managedDepartments: { select: { id: true } },
      managedTopics: { select: { id: true } },
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  if (!user) return null;

  const permissions: GrantedPermission[] = [];
  for (const grant of user.roles) {
    for (const rolePermission of grant.role.permissions) {
      permissions.push({
        key: rolePermission.permission.key,
        // The narrower of the role grant scope and the permission scope wins.
        scope: narrowerScope(grant.scope, rolePermission.scope),
        branchId: grant.branchId,
        departmentId: grant.departmentId,
        topicId: grant.topicId,
      });
    }
  }

  return {
    userId: user.id,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    companyId: user.companyId,
    branchId: user.branchId,
    departmentId: user.departmentId,
    positionId: user.positionId,
    branchName: user.branch?.name ?? null,
    departmentName: user.department?.name ?? null,
    positionName: user.position?.name ?? null,
    roleKeys: user.roles.map((grant) => grant.role.key),
    permissions,
    managedDepartmentIds: user.managedDepartments.map((d) => d.id),
    managedTopicIds: user.managedTopics.map((t) => t.id),
  };
}

const SCOPE_WIDTH: Record<PermissionScope, number> = {
  COMPANY: 4,
  BRANCH: 3,
  DEPARTMENT: 2,
  TOPIC: 1,
  OWN: 0,
};

function narrowerScope(a: PermissionScope, b: PermissionScope): PermissionScope {
  return SCOPE_WIDTH[a] <= SCOPE_WIDTH[b] ? a : b;
}

export function hasPermission(actor: ActorContext, key: PermissionKey): boolean {
  return actor.permissions.some((grant) => grant.key === key);
}

export type ScopeTarget = {
  branchId?: string | null;
  departmentId?: string | null;
  topicId?: string | null;
  ownerId?: string | null;
};

/// Server-side scope check. A company grant passes everything; narrower grants must match the target.
export function hasScopedPermission(
  actor: ActorContext,
  key: PermissionKey,
  target: ScopeTarget = {},
): boolean {
  return actor.permissions.some((grant) => {
    if (grant.key !== key) return false;
    switch (grant.scope) {
      case "COMPANY":
        return true;
      case "BRANCH":
        return grant.branchId
          ? grant.branchId === target.branchId
          : actor.branchId !== null && actor.branchId === target.branchId;
      case "DEPARTMENT":
        return grant.departmentId
          ? grant.departmentId === target.departmentId
          : actor.departmentId !== null && actor.departmentId === target.departmentId;
      case "TOPIC":
        return grant.topicId
          ? grant.topicId === target.topicId
          : actor.managedTopicIds.includes(String(target.topicId));
      case "OWN":
        return target.ownerId === actor.userId;
      default:
        return false;
    }
  });
}

export function isCommunicationAdmin(actor: ActorContext): boolean {
  return (
    actor.roleKeys.includes(ROLE_KEYS.communicationAdmin) ||
    actor.roleKeys.includes(ROLE_KEYS.systemAdmin)
  );
}

export function isSystemAdmin(actor: ActorContext): boolean {
  return actor.roleKeys.includes(ROLE_KEYS.systemAdmin);
}
