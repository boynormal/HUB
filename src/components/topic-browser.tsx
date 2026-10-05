"use client";

import Link from "next/link";
import { useState } from "react";

type Topic = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
};

export function TopicBrowser({ topics }: { topics: Topic[] }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) => !needle || topic.name.toLocaleLowerCase().includes(needle));

  return (
    <div className="mt-4">
      <label className="sr-only" htmlFor="topic-browser">
        ค้นหาหัวข้อ
      </label>
      <input
        id="topic-browser"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ค้นหาชื่อหัวข้อ"
        className="thumb-zone w-full rounded-xl border border-line bg-surface px-3 text-[15px]"
      />
      {visible.length === 0 ? (
        <p className="hub-card mt-3 p-4 text-sm text-muted">ไม่พบหัวข้อที่ค้นหา</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {visible.map((topic) => (
            <li key={topic.id}>
              <Link
                href={`/?topic=${topic.slug}`}
                className="thumb-zone hub-card flex items-center gap-3 px-4 text-sm hover:bg-surface-muted"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: topic.color ?? "var(--hub-muted)" }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
                <span className="text-xs text-muted">{topic.postCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedTopicList({
  topics,
  selectedSlug,
  tag,
  priority,
}: {
  topics: Topic[];
  selectedSlug?: string;
  tag?: string;
  priority?: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) => !needle || topic.name.toLocaleLowerCase().includes(needle));

  function href(slug: string) {
    const next = new URLSearchParams();
    if (tag) next.set("tag", tag);
    if (priority) next.set("priority", priority);
    next.set("topic", slug);
    return `/?${next.toString()}`;
  }

  return (
    <div>
      <label className="sr-only" htmlFor="feed-topic-search">
        ค้นหาหัวข้อ
      </label>
      <input
        id="feed-topic-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ค้นหาชื่อหัวข้อ"
        className="thumb-zone mb-2 w-full rounded-xl border border-line bg-surface px-3 text-[15px]"
      />
      {visible.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">ไม่พบหัวข้อที่ค้นหา</p>
      ) : (
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {visible.map((topic) => {
            const selected = selectedSlug === topic.slug;
            return (
              <li key={topic.id}>
                <Link
                  href={href(topic.slug)}
                  aria-current={selected ? "page" : undefined}
                  className={`thumb-zone flex items-center gap-3 rounded-[10px] px-3 text-sm ${
                    selected ? "bg-accent font-semibold text-accent-ink" : "text-ink hover:bg-surface-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-accent-ink" : ""}`}
                    style={selected ? undefined : { backgroundColor: topic.color ?? "var(--hub-muted)" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                  <span className={`tabular-nums text-xs ${selected ? "text-accent-ink" : "text-muted"}`}>
                    {topic.postCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
