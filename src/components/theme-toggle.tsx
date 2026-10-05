"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";

type Theme = "light" | "dark";

/// The theme lives on the html element, set by the inline script in the layout before first
/// paint. This subscribes to that attribute instead of keeping a second copy in React state.
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "light");
  const isDark = theme === "dark";

  function apply(next: Theme) {
    document.documentElement.dataset.theme = next;
    localStorage.setItem("hub-theme", next);
  }

  return (
    <button
      type="button"
      onClick={() => apply(isDark ? "light" : "dark")}
      aria-label={isDark ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด"}
      aria-pressed={isDark}
      className={`thumb-zone inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-medium text-ink ${className}`}
    >
      <Icon name={isDark ? "moon" : "sun"} className="h-4 w-4" />
      {compact ? null : <span>{isDark ? "ธีมมืด" : "ธีมสว่าง"}</span>}
    </button>
  );
}
