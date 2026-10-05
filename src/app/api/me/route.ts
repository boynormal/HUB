import { NextResponse } from "next/server";
import { getActor } from "@/server/auth/actor";
import { unreadNotificationCount } from "@/server/notifications";
import { jsonError } from "@/server/http";

/// The client shell uses this to know who is signed in and what to show.
export async function GET() {
  try {
    const actor = await getActor();
    if (!actor) return NextResponse.json({ signedIn: false }, { status: 200 });
    return NextResponse.json({
      signedIn: true,
      user: {
        id: actor.userId,
        employeeCode: actor.employeeCode,
        fullName: actor.fullName,
        nickname: actor.nickname,
        avatarUrl: actor.avatarUrl,
        branchName: actor.branchName,
        departmentName: actor.departmentName,
        positionName: actor.positionName,
        roleKeys: actor.roleKeys,
      },
      unreadNotifications: await unreadNotificationCount(actor.userId),
    });
  } catch (error) {
    return jsonError(error);
  }
}
