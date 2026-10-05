"use client";

import { useRouter } from "next/navigation";

export function UserChip({ fullName, detail }: { fullName: string; detail: string }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/signin");
  }

  return (
    <div className="thumb-zone hidden items-center gap-3 rounded-full border border-line bg-surface px-4 xl:flex">
      <div className="text-end leading-tight">
        <p className="text-sm font-medium">{fullName}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <button type="button" className="text-xs text-muted underline" onClick={() => void signOut()}>
        ออกจากระบบ
      </button>
    </div>
  );
}
