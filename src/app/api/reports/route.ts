import { NextResponse } from "next/server";
import { HttpError, requireActor } from "@/server/auth/actor";
import { PERMISSIONS, hasScopedPermission, isCommunicationAdmin } from "@/server/rbac";
import {
  branchReport,
  departmentReport,
  employeeReport,
  postReport,
  topicReport,
} from "@/server/reports";
import { loadAcknowledgementSummary } from "@/server/feed";
import { jsonError } from "@/server/http";

/// One endpoint with a `view` parameter keeps the report screen to a single request per tab.
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    if (!isCommunicationAdmin(actor) && !hasScopedPermission(actor, PERMISSIONS.viewReports, {})) {
      throw new HttpError(403, "ไม่มีสิทธิ์ดูรายงาน");
    }

    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "summary";

    switch (view) {
      case "posts":
        return NextResponse.json({ rows: await postReport() });
      case "branches":
        return NextResponse.json({ rows: await branchReport() });
      case "departments":
        return NextResponse.json({ rows: await departmentReport() });
      case "employees":
        return NextResponse.json({
          rows: await employeeReport({
            branchId: url.searchParams.get("branch"),
            departmentId: url.searchParams.get("department"),
          }),
        });
      case "topics":
        return NextResponse.json({ rows: await topicReport() });
      default:
        return NextResponse.json({
          summary: await loadAcknowledgementSummary(
            Number(url.searchParams.get("days") ?? 30) || 30,
          ),
        });
    }
  } catch (error) {
    return jsonError(error);
  }
}
