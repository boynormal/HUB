"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RestorePostButton({ postId, compact = false }: { postId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!window.confirm("นำประกาศนี้กลับไปแสดงในฟีด?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/restore`, { method: "POST" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "นำกลับไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        onClick={() => void restore()}
        className={`thumb-zone inline-flex items-center rounded-full bg-accent font-semibold text-accent-ink disabled:opacity-60 ${
          compact ? "px-4 text-sm" : "px-4 text-sm"
        }`}
      >
        {busy ? "กำลังนำกลับ…" : "นำกลับมาแสดง"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
