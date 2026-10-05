"use client";

import { useState } from "react";

export function RemindButton({ postId, pending }: { postId: string; pending: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function remind() {
    setState("busy");
    const response = await fetch(`/api/posts/${postId}/remind`, { method: "POST" });
    const data = (await response.json()) as { count?: number; error?: string };
    if (!response.ok) {
      setState("error");
      setMessage(data.error ?? "ส่งเตือนไม่สำเร็จ");
      return;
    }
    setState("done");
    setMessage(`ส่งเตือนแล้ว ${data.count ?? 0} คน`);
  }

  return (
    <div>
      <button
        type="button"
        onClick={remind}
        disabled={state === "busy"}
        className="thumb-zone inline-flex items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {state === "busy" ? "กำลังส่ง…" : `เตือนผู้ที่ยังไม่รับทราบ (${pending} คน)`}
      </button>
      {message ? (
        <p
          role="status"
          className={`mt-2 text-sm ${state === "error" ? "text-danger" : "text-success"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
