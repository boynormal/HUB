import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

/// Everything the recipient step of the composer needs, in one request.
export async function GET() {
  try {
    await requireActor();
    const [branches, departments, positions, roles, groups, activeEmployees] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true, branchId: true },
        orderBy: { name: "asc" },
      }),
      prisma.position.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.role.findMany({ select: { id: true, key: true, name: true }, orderBy: { name: "asc" } }),
      prisma.group.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
    ]);

    return NextResponse.json({
      branches,
      departments,
      positions,
      roles,
      groups,
      activeEmployees,
    });
  } catch (error) {
    return jsonError(error);
  }
}
