"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("ลบประกาศนี้? คนที่ได้รับจะไม่เห็นในฟีดอีก")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "ลบไม่สำเร็จ");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        onClick={() => void remove()}
        className="thumb-zone inline-flex items-center rounded-lg border border-danger px-3 text-sm font-medium text-danger disabled:opacity-60"
      >
        {busy ? "กำลังลบ…" : "ลบประกาศ"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
