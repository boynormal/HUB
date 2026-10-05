import { prisma } from "@/server/db";
import type { ActorContext } from "@/server/rbac";

export type SearchHit = {
  id: string;
  title: string;
  snippet: string;
  topicName: string;
  postType: string;
  priority: string;
  publishedAt: Date | null;
  authorName: string;
  viewerRead: boolean;
  viewerAcknowledged: boolean;
  score: number;
};

type SearchRow = {
  id: string;
  title: string;
  snippet: string;
  topic_name: string;
  post_type: string;
  priority: string;
  published_at: Date | null;
  author_name: string;
  read_at: Date | null;
  acknowledged_at: Date | null;
  score: number;
};

/// Thai has no word boundaries, so the standard text search configuration cannot tokenise it.
/// Trigram similarity handles Thai and partial words; the ILIKE clause keeps exact substrings
/// on top even when the term is shorter than a trigram window.
export async function searchPosts(
  actor: ActorContext,
  term: string,
  limit = 30,
): Promise<SearchHit[]> {
  const query = term.trim();
  if (query.length === 0) return [];

  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      p.id,
      p.title,
      left(regexp_replace(coalesce(nullif(p.summary, ''), p.content), '<[^>]*>', ' ', 'g'), 240) AS snippet,
      t.name AS topic_name,
      p.post_type::text AS post_type,
      p.priority::text AS priority,
      p.published_at,
      u.full_name AS author_name,
      r.read_at,
      r.acknowledged_at,
      GREATEST(
        similarity(p.title, ${query}),
        similarity(coalesce(p.summary, ''), ${query}),
        similarity(left(p.content, 2000), ${query})
      )::float8 AS score
    FROM communication_posts p
    JOIN communication_topics t ON t.id = p.topic_id
    JOIN users u ON u.id = p.author_id
    JOIN communication_post_receipts r ON r.post_id = p.id AND r.user_id = ${actor.userId}
    WHERE p.deleted_at IS NULL
      AND p.status IN ('PUBLISHED', 'EXPIRED')
      AND (
        p.title ILIKE ${"%" + query + "%"}
        OR coalesce(p.summary, '') ILIKE ${"%" + query + "%"}
        OR p.content ILIKE ${"%" + query + "%"}
        OR p.title % ${query}
        OR coalesce(p.summary, '') % ${query}
      )
    ORDER BY score DESC, p.published_at DESC NULLS LAST
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: row.snippet?.replace(/\s+/g, " ").trim() ?? "",
    topicName: row.topic_name,
    postType: row.post_type,
    priority: row.priority,
    publishedAt: row.published_at,
    authorName: row.author_name,
    viewerRead: row.read_at !== null,
    viewerAcknowledged: row.acknowledged_at !== null,
    score: Number(row.score ?? 0),
  }));
}

/// Fallback used when pg_trgm is unavailable on the server.
export async function searchPostsBasic(
  actor: ActorContext,
  term: string,
  limit = 30,
): Promise<SearchHit[]> {
  const query = term.trim();
  if (query.length === 0) return [];
  const posts = await prisma.communicationPost.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PUBLISHED", "EXPIRED"] },
      receipts: { some: { userId: actor.userId } },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      topic: { select: { name: true } },
      author: { select: { fullName: true } },
      receipts: { where: { userId: actor.userId }, select: { readAt: true, acknowledgedAt: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  return posts.map((post) => ({
    id: post.id,
    title: post.title,
    snippet: (post.summary ?? post.content).replace(/<[^>]*>/g, " ").slice(0, 240).trim(),
    topicName: post.topic.name,
    postType: post.postType,
    priority: post.priority,
    publishedAt: post.publishedAt,
    authorName: post.author.fullName,
    viewerRead: post.receipts[0]?.readAt !== null && post.receipts[0]?.readAt !== undefined,
    viewerAcknowledged:
      post.receipts[0]?.acknowledgedAt !== null && post.receipts[0]?.acknowledgedAt !== undefined,
    score: 0,
  }));
}
