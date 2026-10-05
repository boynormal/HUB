import type { PostStatus } from "@prisma/client";
import { prisma } from "@/server/db";

export type PostReportRow = {
  postId: string;
  title: string;
  topicName: string;
  publishedAt: Date | null;
  requiresConfirmation: boolean;
  confirmationDeadline: Date | null;
  recipients: number;
  read: number;
  acknowledged: number;
  overdue: number;
  comments: number;
};

/// Reports exist to find communication that fell through, not to score employees.
export async function postReport(limit = 50): Promise<PostReportRow[]> {
  const posts = await prisma.communicationPost.findMany({
    where: { deletedAt: null, status: { in: ["PUBLISHED", "EXPIRED", "ARCHIVED"] } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      topic: { select: { name: true } },
      _count: { select: { comments: true, receipts: true } },
    },
  });
  if (posts.length === 0) return [];

  const ids = posts.map((post) => post.id);
  const now = new Date();
  const [readRows, ackRows] = await Promise.all([
    prisma.communicationPostReceipt.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, readAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.communicationPostReceipt.groupBy({
      by: ["postId"],
      where: { postId: { in: ids }, acknowledgedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const readBy = new Map(readRows.map((row) => [row.postId, row._count._all]));
  const ackBy = new Map(ackRows.map((row) => [row.postId, row._count._all]));

  return posts.map((post) => {
    const recipients = post._count.receipts;
    const acknowledged = ackBy.get(post.id) ?? 0;
    const pastDeadline =
      post.requiresConfirmation &&
      post.confirmationDeadline !== null &&
      post.confirmationDeadline.getTime() < now.getTime();
    return {
      postId: post.id,
      title: post.title,
      topicName: post.topic.name,
      publishedAt: post.publishedAt,
      requiresConfirmation: post.requiresConfirmation,
      confirmationDeadline: post.confirmationDeadline,
      recipients,
      read: readBy.get(post.id) ?? 0,
      acknowledged,
      overdue: pastDeadline ? Math.max(0, recipients - acknowledged) : 0,
      comments: post._count.comments,
    };
  });
}

export type GroupReportRow = {
  id: string;
  name: string;
  recipients: number;
  acknowledged: number;
  percent: number;
};

async function groupedAcknowledgement(
  dimension: "branch" | "department",
): Promise<GroupReportRow[]> {
  const units =
    dimension === "branch"
      ? await prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : await prisma.department.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  const rows: GroupReportRow[] = [];
  for (const unit of units) {
    const userFilter = dimension === "branch" ? { branchId: unit.id } : { departmentId: unit.id };
    const where = {
      post: {
        requiresConfirmation: true,
        deletedAt: null,
        status: { in: ["PUBLISHED", "EXPIRED"] satisfies PostStatus[] },
      },
      user: userFilter,
    };
    const [recipients, acknowledged] = await Promise.all([
      prisma.communicationPostReceipt.count({ where }),
      prisma.communicationPostReceipt.count({ where: { ...where, acknowledgedAt: { not: null } } }),
    ]);
    rows.push({
      id: unit.id,
      name: unit.name,
      recipients,
      acknowledged,
      percent: recipients === 0 ? 0 : Math.round((acknowledged / recipients) * 100),
    });
  }
  return rows;
}

export function branchReport(): Promise<GroupReportRow[]> {
  return groupedAcknowledgement("branch");
}

export function departmentReport(): Promise<GroupReportRow[]> {
  return groupedAcknowledgement("department");
}

export type EmployeeReportRow = {
  userId: string;
  fullName: string;
  employeeCode: string;
  branchName: string | null;
  departmentName: string | null;
  total: number;
  read: number;
  acknowledged: number;
  pending: number;
  overdue: number;
};

export async function employeeReport(options: {
  branchId?: string | null;
  departmentId?: string | null;
  limit?: number;
}): Promise<EmployeeReportRow[]> {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...(options.branchId ? { branchId: options.branchId } : {}),
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
    },
    select: {
      id: true,
      fullName: true,
      employeeCode: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { fullName: "asc" },
    take: options.limit ?? 100,
  });
  if (users.length === 0) return [];

  const ids = users.map((user) => user.id);
  const now = new Date();
  const [totals, reads, acks, overdues] = await Promise.all([
    prisma.communicationPostReceipt.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, post: { deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.communicationPostReceipt.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, readAt: { not: null }, post: { deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.communicationPostReceipt.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, acknowledgedAt: { not: null }, post: { deletedAt: null } },
      _count: { _all: true },
    }),
    prisma.communicationPostReceipt.groupBy({
      by: ["userId"],
      where: {
        userId: { in: ids },
        acknowledgedAt: null,
        post: {
          deletedAt: null,
          requiresConfirmation: true,
          confirmationDeadline: { lt: now },
        },
      },
      _count: { _all: true },
    }),
  ]);

  const totalBy = new Map(totals.map((row) => [row.userId, row._count._all]));
  const readBy = new Map(reads.map((row) => [row.userId, row._count._all]));
  const ackBy = new Map(acks.map((row) => [row.userId, row._count._all]));
  const overdueBy = new Map(overdues.map((row) => [row.userId, row._count._all]));

  return users.map((user) => {
    const total = totalBy.get(user.id) ?? 0;
    const acknowledged = ackBy.get(user.id) ?? 0;
    return {
      userId: user.id,
      fullName: user.fullName,
      employeeCode: user.employeeCode,
      branchName: user.branch?.name ?? null,
      departmentName: user.department?.name ?? null,
      total,
      read: readBy.get(user.id) ?? 0,
      acknowledged,
      pending: Math.max(0, total - acknowledged),
      overdue: overdueBy.get(user.id) ?? 0,
    };
  });
}

export type TopicReportRow = {
  topicId: string;
  name: string;
  posts: number;
  recipients: number;
  acknowledged: number;
  comments: number;
};

export async function topicReport(): Promise<TopicReportRow[]> {
  const topics = await prisma.communicationTopic.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const rows: TopicReportRow[] = [];
  for (const topic of topics) {
    const postWhere = { topicId: topic.id, deletedAt: null };
    const [posts, recipients, acknowledged, comments] = await Promise.all([
      prisma.communicationPost.count({ where: postWhere }),
      prisma.communicationPostReceipt.count({ where: { post: postWhere } }),
      prisma.communicationPostReceipt.count({
        where: { post: postWhere, acknowledgedAt: { not: null } },
      }),
      prisma.communicationComment.count({ where: { post: postWhere, deletedAt: null } }),
    ]);
    rows.push({ topicId: topic.id, name: topic.name, posts, recipients, acknowledged, comments });
  }
  return rows;
}

/// Who has not acknowledged yet, for the manager view and the reminder worker.
export async function pendingRecipients(postId: string) {
  return prisma.communicationPostReceipt.findMany({
    where: { postId, acknowledgedAt: null },
    select: {
      id: true,
      readAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          lineUserId: true,
          branch: { select: { name: true } },
          department: { select: { id: true, name: true, managerUserId: true } },
        },
      },
    },
    orderBy: { user: { fullName: "asc" } },
  });
}
