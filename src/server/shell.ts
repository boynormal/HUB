import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { backfillReceiptsForUser } from "@/server/recipients";
import { currentSessionClaims } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { unreadNotificationCount } from "@/server/notifications";
import {
  PERMISSIONS,
  hasPermission,
  isCommunicationAdmin,
  isSystemAdmin,
  type ActorContext,
} from "@/server/rbac";
import type { ShellProps } from "@/components/app-shell";

/// Server pages call this once. A visitor with no session goes to the sign-in screen.
/// An invited LINE account stays on the waiting page until an admin approves it.
export async function requirePageActor(): Promise<ActorContext> {
  const actor = await getActor();
  if (actor) {
    await backfillReceiptsForUser(actor.userId);
    return actor;
  }
  if ((await sessionUserStatus()) === "INVITED") redirect("/signin/pending");
  redirect("/signin");
}

export async function sessionUserStatus(): Promise<"INVITED" | "ACTIVE" | "SUSPENDED" | null> {
  const claims = await currentSessionClaims();
  if (!claims) return null;
  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { status: true },
  });
  return user?.status ?? null;
}

export type ShellData = Omit<ShellProps, "children">;

export async function shellData(actor: ActorContext): Promise<ShellData> {
  const [unreadNotifications, pendingTasks] = await Promise.all([
    unreadNotificationCount(actor.userId),
    prisma.communicationPostReceipt.count({
      where: {
        userId: actor.userId,
        acknowledgedAt: null,
        post: { requiresConfirmation: true, deletedAt: null, status: "PUBLISHED" },
      },
    }),
  ]);

  return {
    user: {
      fullName: actor.fullName,
      employeeCode: actor.employeeCode,
      departmentName: actor.departmentName,
      branchName: actor.branchName,
      avatarUrl: actor.avatarUrl,
    },
    unreadNotifications,
    pendingTasks,
    canCompose: hasPermission(actor, PERMISSIONS.create) || isCommunicationAdmin(actor),
    canViewReports: hasPermission(actor, PERMISSIONS.viewReports) || isCommunicationAdmin(actor),
    isAdmin: isSystemAdmin(actor) || isCommunicationAdmin(actor),
  };
}
