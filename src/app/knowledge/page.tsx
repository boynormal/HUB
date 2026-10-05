import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TypeBadge } from "@/components/badges";
import { prisma } from "@/server/db";
import { isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";
import { toPlainText } from "@/server/sanitize";
import { MANUAL_TYPES } from "@/server/versions";
import { formatThaiDate } from "@/server/time";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; topic?: string }>;
}) {
  const actor = await requirePageActor();
  const { q = "", topic = "" } = await searchParams;
  const term = q.trim();
  const visible = isCommunicationAdmin(actor)
    ? {}
    : {
        OR: [
          { receipts: { some: { userId: actor.userId } } },
          ...(actor.managedTopicIds.length > 0 ? [{ topicId: { in: actor.managedTopicIds } }] : []),
        ],
      };
  const manualWhere = {
    deletedAt: null,
    status: "PUBLISHED" as const,
    postType: { in: [...MANUAL_TYPES] },
    ...visible,
  };
  const filters = [
    ...(isCommunicationAdmin(actor) ? [] : [visible]),
    ...(term
      ? [
          {
            OR: [
              { title: { contains: term, mode: "insensitive" as const } },
              { summary: { contains: term, mode: "insensitive" as const } },
              { content: { contains: term, mode: "insensitive" as const } },
            ],
          },
        ]
      : []),
  ];

  const [shell, topics, posts] = await Promise.all([
    shellData(actor),
    prisma.communicationTopic.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        name: true,
        color: true,
        _count: { select: { posts: { where: manualWhere } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.communicationPost.findMany({
      where: {
        deletedAt: null,
        status: "PUBLISHED",
        postType: { in: [...MANUAL_TYPES] },
        ...(topic ? { topic: { slug: topic } } : {}),
        ...(filters.length > 0 ? { AND: filters } : {}),
      },
      include: {
        topic: { select: { name: true, color: true } },
        author: { select: { fullName: true } },
        versions: { where: { isCurrent: true }, select: { id: true, label: true }, take: 1 },
        attachments: {
          where: { deletedAt: null, mimeType: { startsWith: "image/" } },
          select: { id: true, fileName: true, postVersionId: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">คู่มือและเอกสาร</h1>
      <p className="mt-1 text-sm text-muted">คู่มือและเอกสารที่เผยแพร่ถึงคุณ เปิดแล้วอ่านต่อที่หน้าประกาศเดิม</p>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <nav className="hub-card p-2" aria-label="หัวข้อ">
        <p className="px-3 py-2 text-sm font-semibold">หัวข้อ</p>
        <ul className="space-y-1">
          <li>
            <Link
              href={q ? `/knowledge?q=${encodeURIComponent(q)}` : "/knowledge"}
              aria-current={topic ? undefined : "page"}
              className={`thumb-zone flex items-center gap-3 rounded-[10px] px-3 text-sm ${
                topic ? "text-ink hover:bg-surface-muted" : "bg-accent font-semibold text-accent-ink"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">ทุกหัวข้อ</span>
              <span className={topic ? "text-xs text-muted" : "text-xs text-accent-ink"}>
                {topics.reduce((sum, item) => sum + item._count.posts, 0)}
              </span>
            </Link>
          </li>
          {topics.map((item) => {
            const selected = topic === item.slug;
            const href = `/knowledge?topic=${encodeURIComponent(item.slug)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
            return (
              <li key={item.slug}>
                <Link
                  href={href}
                  aria-current={selected ? "page" : undefined}
                  className={`thumb-zone flex items-center gap-3 rounded-[10px] px-3 text-sm ${
                    selected ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-accent-ink" : ""}`}
                    style={selected ? undefined : { backgroundColor: item.color ?? "var(--hub-muted)" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className={selected ? "text-xs text-accent-ink" : "text-xs text-muted"}>{item._count.posts}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        {topic ? <input type="hidden" name="topic" value={topic} /> : null}
        <label className="sr-only" htmlFor="knowledge-q">
          ค้นหาชื่อหรือเนื้อหา
        </label>
        <input
          id="knowledge-q"
          name="q"
          defaultValue={q}
          placeholder="ค้นหาชื่อหรือเนื้อหา"
          className="thumb-zone w-full rounded-full border border-line bg-surface px-4 text-[15px]"
        />
        <button
          type="submit"
          className="thumb-zone rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          ค้นหา
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          ยังไม่มีคู่มือหรือเอกสารที่ส่งถึงคุณ
        </p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {posts.map((post) => {
            const image = currentImages(post)[0];
            const lead = excerpt(post);
            const topicColor = post.topic.color ?? "var(--hub-accent)";
            return (
              <li key={post.id}>
                <Link href={`/posts/${post.id}`} className="hub-card block p-4">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold" style={{ color: topicColor }}>
                      {post.topic.name}
                    </span>
                    <span className="min-w-0 text-lg font-semibold leading-snug">{post.title}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <TypeBadge postType={post.postType} />
                    <span>เวอร์ชัน {post.versions[0]?.label ?? "1.0"}</span>
                    <span>{post.author.fullName}</span>
                    <span>{formatThaiDate(post.publishedAt)}</span>
                  </span>
                  <span className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    {image ? (
                      <span className="grid h-44 w-full shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-muted sm:h-auto sm:w-64">
                        <img
                          src={`/api/attachments/${image.id}?inline=1`}
                          alt={image.fileName}
                          className="max-h-44 w-full object-contain sm:max-h-48"
                        />
                      </span>
                    ) : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      {lead ? (
                        <span className="line-clamp-4 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">
                          {lead}
                        </span>
                      ) : (
                        <span className="text-sm text-muted">เปิดเพื่ออ่านเนื้อหาฉบับนี้</span>
                      )}
                      <span className="thumb-zone mt-3 inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink sm:ms-auto sm:mt-auto sm:w-auto">
                        ดูหน้าอ่าน
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </div>
      </div>
    </AppShell>
  );
}

function excerpt(post: { title: string; summary: string | null; content: string }): string {
  const summary = post.summary?.trim() ?? "";
  if (summary && summary !== post.title.trim()) return summary;
  const plain = toPlainText(post.content, 220).trim();
  if (!plain || plain === post.title.trim()) return "";
  return plain;
}

function currentImages(post: {
  versions: Array<{ id: string }>;
  attachments: Array<{ id: string; fileName: string; postVersionId: string | null }>;
}) {
  const currentId = post.versions[0]?.id ?? null;
  return post.attachments
    .filter((file) =>
      currentId ? file.postVersionId === currentId || file.postVersionId === null : file.postVersionId === null,
    )
    .slice(0, 4);
}
