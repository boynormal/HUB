"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/read-all", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      className="thumb-zone ms-auto inline-flex items-center rounded-lg border border-line px-3 text-sm font-medium"
    >
      {busy ? "กำลังบันทึก…" : "อ่านทั้งหมดแล้ว"}
    </button>
  );
}
