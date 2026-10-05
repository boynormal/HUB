import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { receiptStatus } from "@/server/reminders";
import { toPlainText } from "@/server/sanitize";
import type { ActorContext } from "@/server/rbac";
import { VISIBLE_STATUSES, type FeedCard, type FeedFilters } from "@/server/posts";

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  URGENT: 1,
  IMPORTANT: 2,
  INFO: 3,
  NORMAL: 4,
};

/// Posts the employee actually received. Receipts are the source of truth after publishing,
/// so a later change to branch or department never removes an announcement already delivered.
function receiptScope(actor: ActorContext): Prisma.CommunicationPostWhereInput {
  return {
    deletedAt: null,
    status: { in: [...VISIBLE_STATUSES] },
    receipts: { some: { userId: actor.userId } },
  };
}

export type FeedResult = {
  action: FeedCard[];
  important: FeedCard[];
  latest: FeedCard[];
  totalLatest: number;
};

const CARD_INCLUDE = {
  topic: { select: { name: true, slug: true, color: true } },
  author: { select: { fullName: true } },
  tags: { include: { tag: { select: { name: true, slug: true } } } },
  versions: { where: { isCurrent: true }, select: { id: true }, take: 1 },
  attachments: {
    where: {
      deletedAt: null,
      OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
    },
    select: { id: true, fileName: true, mimeType: true, postVersionId: true },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { comments: true, attachments: true, receipts: true } },
} satisfies Prisma.CommunicationPostInclude;

type PostWithCard = Prisma.CommunicationPostGetPayload<{ include: typeof CARD_INCLUDE }>;

async function toCards(
  posts: PostWithCard[],
  actor: ActorContext,
  now: Date,
): Promise<FeedCard[]> {
  if (posts.length === 0) return [];
  const postIds = posts.map((post) => post.id);

  const [receipts, stats] = await Promise.all([
    prisma.communicationPostReceipt.findMany({
      where: { postId: { in: postIds }, userId: actor.userId },
      select: { postId: true, readAt: true, acknowledgedAt: true },
    }),
    prisma.communicationPostReceipt.groupBy({
      by: ["postId"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
  ]);

  const readCounts = await prisma.communicationPostReceipt.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, readAt: { not: null } },
    _count: { _all: true },
  });
  const ackCounts = await prisma.communicationPostReceipt.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, acknowledgedAt: { not: null } },
    _count: { _all: true },
  });

  const receiptByPost = new Map(receipts.map((receipt) => [receipt.postId, receipt]));
  const totalByPost = new Map(stats.map((row) => [row.postId, row._count._all]));
  const readByPost = new Map(readCounts.map((row) => [row.postId, row._count._all]));
  const ackByPost = new Map(ackCounts.map((row) => [row.postId, row._count._all]));

  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    summary: post.summary?.trim() ? post.summary.trim() : toPlainText(post.content, 180),
    topicName: post.topic.name,
    topicSlug: post.topic.slug,
    topicColor: post.topic.color,
    postType: post.postType,
    priority: post.priority,
    isPinned: post.isPinned,
    publishedAt: post.publishedAt,
    requiresConfirmation: post.requiresConfirmation,
    confirmationDeadline: post.confirmationDeadline,
    coverImagePath: post.coverImagePath,
    authorName: post.author.fullName,
    tags: post.tags.map((link) => link.tag),
    commentCount: post._count.comments,
    attachmentCount: post._count.attachments,
    images: visibleImages(post),
    readCount: readByPost.get(post.id) ?? 0,
    acknowledgedCount: ackByPost.get(post.id) ?? 0,
    recipientCount: totalByPost.get(post.id) ?? 0,
    viewerStatus: receiptStatus(receiptByPost.get(post.id) ?? null, {
      requiresConfirmation: post.requiresConfirmation,
      deadline: post.confirmationDeadline,
      now,
    }),
  }));
}

function visibleImages(post: PostWithCard): Array<{ id: string; fileName: string; kind: "image" | "video" }> {
  const currentId = post.versions[0]?.id ?? null;
  return post.attachments
    .filter((file) => (currentId ? file.postVersionId === currentId || file.postVersionId === null : file.postVersionId === null))
    .slice(0, 4)
    .map((file) => ({
      id: file.id,
      fileName: file.fileName,
      kind: file.mimeType.startsWith("video/") ? "video" : "image",
    }));
}

function filterWhere(filters: FeedFilters): Prisma.CommunicationPostWhereInput {
  const where: Prisma.CommunicationPostWhereInput = {};
  if (filters.topicSlug) where.topic = { slug: filters.topicSlug };
  if (filters.tagSlug) where.tags = { some: { tag: { slug: filters.tagSlug } } };
  if (filters.priority) {
    where.priority = filters.priority as Prisma.CommunicationPostWhereInput["priority"];
  }
  if (filters.query?.trim()) {
    const term = filters.query.trim();
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
      { content: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

/// Feed order from plan.md section 40: things to act on first, then important, then latest.
export async function loadFeed(
  actor: ActorContext,
  filters: FeedFilters = {},
  options: { latestTake?: number; latestSkip?: number } = {},
): Promise<FeedResult> {
  const now = new Date();
  const latestTake = options.latestTake ?? 10;
  const latestSkip = options.latestSkip ?? 0;
  const scope = receiptScope(actor);
  const base: Prisma.CommunicationPostWhereInput = { ...scope, ...filterWhere(filters) };

  const actionWhere: Prisma.CommunicationPostWhereInput = {
    ...base,
    requiresConfirmation: true,
    receipts: { some: { userId: actor.userId, acknowledgedAt: null } },
  };

  const actionPosts = await prisma.communicationPost.findMany({
    where: actionWhere,
    include: CARD_INCLUDE,
    orderBy: [{ confirmationDeadline: "asc" }, { publishedAt: "desc" }],
    take: 20,
  });

  const importantPosts = await prisma.communicationPost.findMany({
    where: {
      ...base,
      id: { notIn: actionPosts.map((post) => post.id) },
      OR: [{ isPinned: true }, { priority: { in: ["IMPORTANT", "URGENT", "CRITICAL"] } }],
    },
    include: CARD_INCLUDE,
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
    take: 6,
  });

  const excluded = [...actionPosts, ...importantPosts].map((post) => post.id);
  const [latestPosts, totalLatest] = await Promise.all([
    prisma.communicationPost.findMany({
      where: { ...base, id: { notIn: excluded } },
      include: CARD_INCLUDE,
      orderBy: [{ publishedAt: "desc" }],
      take: latestTake,
      skip: latestSkip,
    }),
    prisma.communicationPost.count({ where: { ...base, id: { notIn: excluded } } }),
  ]);

  const [action, important, latest] = await Promise.all([
    toCards(actionPosts, actor, now),
    toCards(importantPosts, actor, now),
    toCards(latestPosts, actor, now),
  ]);

  action.sort(
    (a, b) =>
      (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
      (a.confirmationDeadline?.getTime() ?? Infinity) - (b.confirmationDeadline?.getTime() ?? Infinity),
  );

  return { action, important, latest, totalLatest };
}

export type MyTasks = {
  needsAcknowledgement: FeedCard[];
  unread: FeedCard[];
  dueSoon: FeedCard[];
  overdue: FeedCard[];
  counts: { needsAcknowledgement: number; unread: number; dueSoon: number; overdue: number };
};

/// My Tasks is one of the main screens. Every list here is scoped to the signed-in employee.
export async function loadMyTasks(actor: ActorContext): Promise<MyTasks> {
  const now = new Date();
  const soon = new Date(now.getTime() + 48 * 3600 * 1000);
  const scope = receiptScope(actor);

  const [pendingAck, unreadPosts] = await Promise.all([
    prisma.communicationPost.findMany({
      where: {
        ...scope,
        requiresConfirmation: true,
        receipts: { some: { userId: actor.userId, acknowledgedAt: null } },
      },
      include: CARD_INCLUDE,
      orderBy: [{ confirmationDeadline: "asc" }],
      take: 50,
    }),
    prisma.communicationPost.findMany({
      where: { ...scope, receipts: { some: { userId: actor.userId, readAt: null } } },
      include: CARD_INCLUDE,
      orderBy: [{ publishedAt: "desc" }],
      take: 50,
    }),
  ]);

  const [ackCards, unreadCards] = await Promise.all([
    toCards(pendingAck, actor, now),
    toCards(unreadPosts, actor, now),
  ]);

  const overdue = ackCards.filter(
    (card) => card.confirmationDeadline && card.confirmationDeadline.getTime() < now.getTime(),
  );
  const dueSoon = ackCards.filter(
    (card) =>
      card.confirmationDeadline &&
      card.confirmationDeadline.getTime() >= now.getTime() &&
      card.confirmationDeadline.getTime() <= soon.getTime(),
  );

  return {
    needsAcknowledgement: ackCards,
    unread: unreadCards,
    dueSoon,
    overdue,
    counts: {
      needsAcknowledgement: ackCards.length,
      unread: unreadCards.length,
      dueSoon: dueSoon.length,
      overdue: overdue.length,
    },
  };
}

export type TopicSummary = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  postCount: number;
};

export async function loadTopicSidebar(actor: ActorContext): Promise<TopicSummary[]> {
  const topics = await prisma.communicationTopic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, color: true, icon: true },
  });
  const counts = await prisma.communicationPost.groupBy({
    by: ["topicId"],
    where: receiptScope(actor),
    _count: { _all: true },
  });
  const countByTopic = new Map(counts.map((row) => [row.topicId, row._count._all]));
  return topics.map((topic) => ({ ...topic, postCount: countByTopic.get(topic.id) ?? 0 }));
}

export async function loadPopularTags(limit = 12): Promise<Array<{ name: string; slug: string }>> {
  const rows = await prisma.communicationPostTag.groupBy({
    by: ["tagId"],
    _count: { _all: true },
    orderBy: { _count: { tagId: "desc" } },
    take: limit,
  });
  if (rows.length === 0) {
    return prisma.communicationTag.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
      take: limit,
    });
  }
  const tags = await prisma.communicationTag.findMany({
    where: { id: { in: rows.map((row) => row.tagId) } },
    select: { id: true, name: true, slug: true },
  });
  const order = new Map(rows.map((row, index) => [row.tagId, index]));
  return tags
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((tag) => ({ name: tag.name, slug: tag.slug }));
}

/// Company-wide acknowledgement rate for the dashboard card.
export async function loadAcknowledgementSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const [total, read, acknowledged] = await Promise.all([
    prisma.communicationPostReceipt.count({
      where: { post: { requiresConfirmation: true, publishedAt: { gte: since }, deletedAt: null } },
    }),
    prisma.communicationPostReceipt.count({
      where: {
        post: { requiresConfirmation: true, publishedAt: { gte: since }, deletedAt: null },
        readAt: { not: null },
        acknowledgedAt: null,
      },
    }),
    prisma.communicationPostReceipt.count({
      where: {
        post: { requiresConfirmation: true, publishedAt: { gte: since }, deletedAt: null },
        acknowledgedAt: { not: null },
      },
    }),
  ]);
  const unread = Math.max(0, total - read - acknowledged);
  const percent = total === 0 ? 0 : Math.round((acknowledged / total) * 100);
  return { total, read, acknowledged, unread, percent };
}
