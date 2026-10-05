"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Topic = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
};

export function TopicSheet({
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = topics.find((topic) => topic.slug === selectedSlug);
  const needle = query.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) => !needle || topic.name.toLocaleLowerCase().includes(needle));

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function href(slug?: string) {
    const next = new URLSearchParams();
    if (tag) next.set("tag", tag);
    if (priority) next.set("priority", priority);
    if (slug) next.set("topic", slug);
    const text = next.toString();
    return text ? `/?${text}` : "/";
  }

  return (
    <div className="my-2 shrink-0 xl:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="thumb-zone flex w-full items-center gap-3 rounded-2xl border border-accent bg-accent-soft px-4 text-start"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-accent">หัวข้อ</span>
          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
            {selected ? (
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: selected.color ?? "var(--hub-muted)" }}
              />
            ) : null}
            <span className="truncate">{selected?.name ?? "เลือกหัวข้อ"}</span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="เลือกหัวข้อ"
          onClick={() => setOpen(false)}
        >
          <div
            className="safe-bottom max-h-[75vh] w-full rounded-t-3xl bg-surface p-4 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-base font-semibold">หัวข้อ</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="thumb-zone rounded-full border border-line px-4 text-sm font-medium"
              >
                ปิด
              </button>
            </div>
            <label className="sr-only" htmlFor="topic-sheet-search">
              ค้นหาหัวข้อ
            </label>
            <input
              id="topic-sheet-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ค้นหาชื่อหัวข้อ"
              className="thumb-zone mb-3 w-full rounded-xl border border-line bg-surface px-3 text-[15px]"
            />
            <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
              {!needle ? (
                <li>
                  <SheetLink href={href()} selected={!selectedSlug} label="ทั้งหมด" onPick={() => setOpen(false)} />
                </li>
              ) : null}
              {visible.map((topic) => (
                <li key={topic.id}>
                  <SheetLink
                    href={href(topic.slug)}
                    selected={selectedSlug === topic.slug}
                    label={topic.name}
                    color={topic.color}
                    count={topic.postCount}
                    onPick={() => setOpen(false)}
                  />
                </li>
              ))}
            </ul>
            {needle && visible.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">ไม่พบหัวข้อ</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SheetLink({
  href,
  selected,
  label,
  color,
  count,
  onPick,
}: {
  href: string;
  selected: boolean;
  label: string;
  color?: string | null;
  count?: number;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={selected ? "page" : undefined}
      onClick={onPick}
      className={`thumb-zone flex items-center gap-3 rounded-[10px] px-3 text-sm ${
        selected ? "bg-accent font-semibold text-accent-ink" : "text-ink"
      }`}
    >
      {color !== undefined ? (
        <span
          aria-hidden="true"
          className={`h-2 w-2 shrink-0 rounded-full ${selected ? "bg-accent-ink" : ""}`}
          style={selected ? undefined : { backgroundColor: color ?? "var(--hub-muted)" }}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className={`text-xs tabular-nums ${selected ? "text-accent-ink" : "text-muted"}`}>{count}</span>
      ) : null}
    </Link>
  );
}
