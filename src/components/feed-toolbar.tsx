"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { FeedSearch } from "@/components/feed-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";

type Tab = { key: string; label: string; href: string };

const SEARCH_SLOT = 288;

function tabClass(active: boolean) {
  return `thumb-zone inline-flex shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap ${
    active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted"
  }`;
}

export function FeedToolbar({
  tabs,
  view,
  fullName,
  detail,
}: {
  tabs: Tab[];
  view: string;
  fullName: string;
  detail: string;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [open, setOpen] = useState(false);
  const current = tabs.find((tab) => tab.key === view) ?? tabs[0];

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const sizer = sizerRef.current;
      if (!sizer) return;
      const styles = getComputedStyle(bar);
      const pad = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const gap = parseFloat(styles.columnGap || "8") || 8;
      const themeWidth = themeRef.current?.offsetWidth ?? 0;
      const userWidth = userRef.current?.offsetWidth ?? 0;
      const slots = 1 + (themeWidth > 0 ? 1 : 0) + (userWidth > 0 ? 1 : 0);
      const needed = sizer.offsetWidth + SEARCH_SLOT + themeWidth + userWidth + gap * slots + pad;
      setCollapsed(needed > bar.clientWidth + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div
      ref={barRef}
      className="bar relative z-20 mb-0 flex shrink-0 flex-nowrap items-center gap-2 rounded-[24px] border px-3 py-2 shadow-[var(--shadow-panel)] xl:mb-3"
    >
      <div className="pointer-events-none absolute start-0 top-0 -z-10 opacity-0" aria-hidden="true">
        <div ref={sizerRef} className="flex w-max items-center gap-2">
          {tabs.map((tab) => (
            <span key={tab.key} className={tabClass(tab.key === view)}>
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      {collapsed ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            className={tabClass(true)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={`มุมมองฟีด ${current?.label ?? ""}`}
            onClick={() => setOpen((value) => !value)}
          >
            {current?.label}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open ? (
            <div
              role="menu"
              aria-label="มุมมองฟีด"
              className="absolute start-0 top-[calc(100%+0.5rem)] z-30 min-w-44 rounded-2xl border border-line bg-surface p-1 shadow-[var(--shadow-panel)]"
            >
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  role="menuitem"
                  aria-current={tab.key === view ? "page" : undefined}
                  className={`thumb-zone flex items-center rounded-xl px-3 text-sm font-medium ${
                    tab.key === view ? "bg-accent text-accent-ink" : "text-ink hover:bg-surface-muted"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <nav className="flex items-center gap-2" aria-label="มุมมองฟีด">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.key === view ? "page" : undefined}
              className={tabClass(tab.key === view)}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="ms-auto flex min-w-0 items-center justify-end gap-2">
        <FeedSearch className="w-56 max-w-full sm:w-72" />
        <div ref={themeRef} className="shrink-0">
          <ThemeToggle compact className="shrink-0 px-3" />
        </div>
        <div ref={userRef} className="hidden shrink-0 xl:block">
          <UserChip fullName={fullName} detail={detail} />
        </div>
      </div>
    </div>
  );
}
