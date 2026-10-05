import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

/// Lookup for the mention box. Returns a small list and never the whole directory.
export async function GET(request: Request) {
  try {
    await requireActor();
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 1) return NextResponse.json({ results: [] });

    const [users, departments, branches, groups] = await Promise.all([
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { nickname: { contains: query, mode: "insensitive" } },
            { employeeCode: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: { select: { name: true } },
        },
        take: 8,
      }),
      prisma.department.findMany({
        where: { isActive: true, name: { contains: query, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 4,
      }),
      prisma.branch.findMany({
        where: { isActive: true, name: { contains: query, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 4,
      }),
      prisma.group.findMany({
        where: { isActive: true, name: { contains: query, mode: "insensitive" } },
        select: { id: true, name: true },
        take: 4,
      }),
    ]);

    return NextResponse.json({
      results: [
        ...users.map((user) => ({
          kind: "user" as const,
          id: user.id,
          label: user.fullName,
          hint: user.department?.name ?? user.employeeCode,
        })),
        ...departments.map((row) => ({
          kind: "department" as const,
          id: row.id,
          label: row.name,
          hint: "แผนก",
        })),
        ...branches.map((row) => ({
          kind: "branch" as const,
          id: row.id,
          label: row.name,
          hint: "สาขา",
        })),
        ...groups.map((row) => ({
          kind: "group" as const,
          id: row.id,
          label: row.name,
          hint: "กลุ่ม",
        })),
      ],
    });
  } catch (error) {
    return jsonError(error);
  }
}
