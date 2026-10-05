import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/http";

const userSelect = {
  id: true,
  fullName: true,
  nickname: true,
  employeeCode: true,
  avatarUrl: true,
  department: { select: { name: true } },
} as const;

function wantsAll(query: string) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return "all".startsWith(needle) || "ทั้งหมด".includes(query);
}

function matches(user: { fullName: string; nickname: string | null; employeeCode: string }, query: string) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return [user.fullName, user.nickname ?? "", user.employeeCode].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  );
}

/// People already tied to this post: the author, commenters, and recipients.
async function relatedPeople(postId: string, query: string, exceptUserId: string) {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) return [];

  const [receipts, comments, author] = await Promise.all([
    prisma.communicationPostReceipt.findMany({
      where: { postId, user: { status: "ACTIVE" } },
      select: { user: { select: userSelect } },
      take: 40,
    }),
    prisma.communicationComment.findMany({
      where: { postId, deletedAt: null, user: { status: "ACTIVE" } },
      select: { userId: true, user: { select: userSelect } },
      take: 20,
    }),
    prisma.user.findFirst({
      where: { id: post.authorId, status: "ACTIVE" },
      select: userSelect,
    }),
  ]);

  const ordered = [
    ...(author ? [author] : []),
    ...comments.map((row) => row.user),
    ...receipts.map((row) => row.user),
  ];
  const seen = new Set<string>();
  const people = [];
  for (const user of ordered) {
    if (seen.has(user.id) || user.id === exceptUserId || !matches(user, query)) continue;
    seen.add(user.id);
    people.push(user);
    if (people.length >= 8) break;
  }
  return people;
}

/// Lookup for the mention box. A bare @ lists people on this post. Typing more narrows the list.
export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const postId = url.searchParams.get("postId")?.trim() ?? "";
    if (query.length < 1 && !postId) return NextResponse.json({ results: [] });

    let related = postId ? await relatedPeople(postId, query, actor.userId) : [];
    if (query.length < 1 && related.length === 0) {
      related = await prisma.user.findMany({
        where: { status: "ACTIVE", id: { not: actor.userId } },
        select: userSelect,
        orderBy: { fullName: "asc" },
        take: 8,
      });
    }
    const all = postId && wantsAll(query)
      ? [{ kind: "all" as const, id: postId, label: "All", hint: "", avatarUrl: null as string | null }]
      : [];

    if (query.length < 1) {
      return NextResponse.json({
        results: [
          ...all,
          ...related.map((user) => ({
            kind: "user" as const,
            id: user.id,
            label: user.fullName,
            hint: user.department?.name ?? user.employeeCode,
            avatarUrl: user.avatarUrl,
          })),
        ],
      });
    }

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
        select: userSelect,
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

    const listed = new Set(related.map((user) => user.id));
    return NextResponse.json({
      results: [
        ...all,
        ...related.map((user) => ({
          kind: "user" as const,
          id: user.id,
          label: user.fullName,
          hint: user.department?.name ?? user.employeeCode,
          avatarUrl: user.avatarUrl,
        })),
        ...users
          .filter((user) => !listed.has(user.id) && user.id !== actor.userId)
          .map((user) => ({
            kind: "user" as const,
            id: user.id,
            label: user.fullName,
            hint: user.department?.name ?? user.employeeCode,
            avatarUrl: user.avatarUrl,
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
