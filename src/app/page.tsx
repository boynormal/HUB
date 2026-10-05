import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FeedToolbar } from "@/components/feed-toolbar";
import { FeedTopicList } from "@/components/topic-browser";
import { TopicSheet } from "@/components/topic-sheet";
import { PostCard } from "@/components/post-card";
import { Icon } from "@/components/icons";
import {
  loadAcknowledgementSummary,
  loadFeed,
  loadPopularTags,
  loadTopicSidebar,
} from "@/server/feed";
import { requirePageActor, shellData } from "@/server/shell";
import { deadlineLabel } from "@/server/time";

type SearchParams = Promise<{ topic?: string; tag?: string; priority?: string; view?: string }>;

const TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "latest", label: "ล่าสุด" },
  { key: "important", label: "สำคัญ" },
  { key: "action", label: "ต้องรับทราบ" },
];

export default async function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePageActor();
  const params = await searchParams;

  const [shell, feed, topics, tags, summary] = await Promise.all([
    shellData(actor),
    loadFeed(actor, {
      topicSlug: params.topic ?? null,
      tagSlug: params.tag ?? null,
      priority: params.priority ?? null,
    }),
    loadTopicSidebar(actor),
    loadPopularTags(10),
    loadAcknowledgementSummary(30),
  ]);

  const view = params.view ?? (feed.action.length > 0 ? "action" : "latest");

  const queryString = (extra: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...extra })) {
      if (value) next.set(key, value);
    }
    const text = next.toString();
    return text.length > 0 ? `/?${text}` : "/";
  };

  const showAction = view === "all" || view === "action";
  const showImportant = view === "all" || view === "important";
  const showLatest = view === "all" || view === "latest";
  const empty =
    (!showAction || feed.action.length === 0) &&
    (!showImportant || feed.important.length === 0) &&
    (!showLatest || feed.latest.length === 0);

  return (
    <AppShell {...shell}>
      <div className="feed-frame grid min-h-0 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex h-full min-h-0 min-w-0 flex-col">
          <h1 className="sr-only">ฟีด</h1>
          <FeedToolbar
            tabs={TABS.map((tab) => ({ ...tab, href: queryString({ view: tab.key }) }))}
            view={view}
            fullName={shell.user.fullName}
            detail={shell.user.departmentName ?? shell.user.employeeCode}
          />

          {params.topic || params.tag ? (
            <p className="mt-2 shrink-0 text-sm text-muted">
              กรอง: {params.topic ? `หัวข้อ ${params.topic}` : ""}{" "}
              {params.tag ? `แท็ก #${params.tag}` : ""}{" "}
              <Link href="/" className="text-accent underline">
                ล้างตัวกรอง
              </Link>
            </p>
          ) : null}

          <TopicSheet topics={topics} selectedSlug={params.topic} tag={params.tag} priority={params.priority} />

          <div className="scroll-plain min-h-0 flex-1 overflow-y-auto overscroll-contain max-xl:[&>:first-child]:mt-0">
          {empty ? (
            <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
              ยังไม่มีประกาศที่ส่งถึงคุณ
            </p>
          ) : null}

          {showAction && feed.action.length > 0 ? (
            <section className="mt-5" aria-labelledby="feed-action">
              <h2 id="feed-action" className="section-label">
                ต้องรับทราบ
              </h2>
              <div className="grid gap-3">
                {feed.action.map((card) => (
                  <PostCard key={card.id} card={card} />
                ))}
              </div>
            </section>
          ) : null}

          {showImportant && feed.important.length > 0 ? (
            <section className="mt-6" aria-labelledby="feed-important">
              <h2 id="feed-important" className="section-label">
                สำคัญ
              </h2>
              <div className="grid gap-3">
                {feed.important.map((card) => (
                  <PostCard key={card.id} card={card} />
                ))}
              </div>
            </section>
          ) : null}

          {showLatest && feed.latest.length > 0 ? (
            <section className="mt-6" aria-labelledby="feed-latest">
              <h2 id="feed-latest" className="section-label">
                ล่าสุด
              </h2>
              {shell.canCompose ? (
                <Link
                  href="/compose"
                  className="thumb-zone mx-auto mb-3 flex w-full max-w-xl items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
                >
                  <Icon name="plus" className="h-4 w-4" /> สร้างประกาศ
                </Link>
              ) : null}
              <div className="grid gap-3">
                {feed.latest.map((card) => (
                  <PostCard key={card.id} card={card} />
                ))}
              </div>
              {feed.totalLatest > feed.latest.length ? (
                <p className="mt-3 text-center text-sm text-muted">
                  แสดง {feed.latest.length} จาก {feed.totalLatest} ประกาศ
                </p>
              ) : null}
            </section>
          ) : null}
          </div>
        </div>

        <aside className="scroll-plain hidden h-full space-y-4 overflow-y-auto xl:block">
          <section className="glass glass-thick glass-rim relative p-4">
            <h2 className="text-sm font-semibold">สรุปการรับทราบ 30 วัน</h2>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(var(--hub-accent) ${summary.percent * 3.6}deg, var(--hub-surface-muted) 0deg)`,
                }}
                role="img"
                aria-label={`อัตราการรับทราบ ${summary.percent} เปอร์เซ็นต์`}
              >
                <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-surface">
                  <span className="text-lg font-semibold text-accent">{summary.percent}%</span>
                </div>
              </div>
              <p className="text-sm text-muted">
                รับทราบ {summary.acknowledged} จาก {summary.total} รายการ
              </p>
            </div>
          </section>

          {feed.action.length > 0 ? (
            <section className="hub-card mt-4 p-4">
              <h2 className="text-sm font-semibold">ประกาศที่ต้องรับทราบ</h2>
              <ul className="mt-3 space-y-2">
                {feed.action.slice(0, 5).map((card) => (
                  <li key={card.id}>
                    <Link
                      href={`/posts/${card.id}`}
                      className="block rounded-xl border border-line bg-surface-muted px-3 py-2"
                    >
                      <span className="block text-sm font-medium">{card.title}</span>
                      {card.confirmationDeadline ? (
                        <span className="mt-0.5 block text-xs text-danger">
                          {deadlineLabel(card.confirmationDeadline)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="hub-card mt-4 p-3">
            <h2 className="px-2 pb-2 text-sm font-semibold">หัวข้อ</h2>
            <FeedTopicList topics={topics} selectedSlug={params.topic} tag={params.tag} priority={params.priority} />
          </section>

          <section className="hub-card mt-4 p-4">
            <h2 className="text-sm font-semibold">#แท็กยอดนิยม</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link
                  key={tag.slug}
                  href={queryString({ tag: tag.slug, view: undefined })}
                  className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted hover:text-ink"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
