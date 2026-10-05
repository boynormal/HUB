"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/// Password sign-in is limited to admin accounts on the server. Everyone else uses LINE.
export function AdminSignInForm() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }
      router.replace("/");
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-muted">รหัสพนักงาน</span>
        <input
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
          autoComplete="username"
          required
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">รหัสผ่าน</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="thumb-zone w-full rounded-lg bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
