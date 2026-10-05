"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";

export function FeedSearch({ className = "w-64 sm:w-80" }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const term = query.trim();
    if (term.length > 0) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <form onSubmit={submit} className={`relative min-w-0 ${className}`} role="search">
      <label className="sr-only" htmlFor="hub-search">
        ค้นหาประกาศ
      </label>
      <Icon
        name="search"
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      />
      <input
        id="hub-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ค้นหาประกาศ"
        className="thumb-zone w-full rounded-full border border-line bg-surface ps-9 pe-3 text-[15px] text-ink placeholder:text-muted"
        enterKeyHint="search"
      />
    </form>
  );
}
