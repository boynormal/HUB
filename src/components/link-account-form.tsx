"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LiffSdk = {
  init: (config: { liffId: string }) => Promise<void>;
  isInClient: () => boolean;
  isLoggedIn: () => boolean;
  getAccessToken: () => string | null;
};

/// Inside LINE the form sends the LIFF access token so the server can verify the identity again.
/// On desktop the server uses the pending cookie written by the LINE callback.
export function LinkAccountForm({ liffId }: { liffId: string | null }) {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!liffId) return;
    const sdk = (window as unknown as { liff?: LiffSdk }).liff;
    if (!sdk) return;
    void sdk
      .init({ liffId })
      .then(() => {
        if (sdk.isInClient() && sdk.isLoggedIn()) setAccessToken(sdk.getAccessToken());
      })
      .catch(() => undefined);
  }, [liffId]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode,
          inviteCode,
          ...(accessToken ? { accessToken } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "ผูกบัญชีไม่สำเร็จ");
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
    <form
      onSubmit={submit}
      className="mt-5 space-y-3"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted">รหัสพนักงาน</span>
        <input
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
          required
          inputMode="text"
          autoComplete="off"
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">รหัสเชิญ</span>
        <input
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
          required
          placeholder="ตัวอย่าง AB34-CD67"
          autoComplete="off"
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px] tracking-wider"
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
        {busy ? "กำลังผูกบัญชี…" : "ผูกบัญชีและเข้าใช้งาน"}
      </button>
    </form>
  );
}
