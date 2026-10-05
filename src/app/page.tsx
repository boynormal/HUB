import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FeedSearch } from "@/components/feed-search";
import { FeedTopicList } from "@/components/topic-browser";
import { PostCard } from "@/components/post-card";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <h1 className="sr-only">ฟีด</h1>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="มุมมองฟีด">
              {TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={queryString({ view: tab.key })}
                  aria-current={view === tab.key ? "page" : undefined}
                  className={`thumb-zone inline-flex shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                    view === tab.key
                      ? "border-accent bg-accent text-accent-ink"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <FeedSearch />
              <ThemeToggle compact className="shrink-0 px-3" />
            </div>
          </div>

          {params.topic || params.tag ? (
            <p className="mt-3 text-sm text-muted">
              กรอง: {params.topic ? `หัวข้อ ${params.topic}` : ""}{" "}
              {params.tag ? `แท็ก #${params.tag}` : ""}{" "}
              <Link href="/" className="text-accent underline">
                ล้างตัวกรอง
              </Link>
            </p>
          ) : null}

          <section className="hub-card mt-4 p-3 lg:hidden">
            <h2 className="px-2 pb-2 text-sm font-semibold">หัวข้อ</h2>
            <FeedTopicList topics={topics} selectedSlug={params.topic} tag={params.tag} priority={params.priority} />
          </section>

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

        <aside className="hidden lg:block lg:space-y-4 xl:sticky xl:top-24">
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
