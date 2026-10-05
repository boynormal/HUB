"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/signin");
      }}
      className="thumb-zone inline-flex items-center rounded-lg border border-line px-4 text-sm font-medium"
    >
      {busy ? "กำลังออก…" : "ออกจากระบบ"}
    </button>
  );
}
