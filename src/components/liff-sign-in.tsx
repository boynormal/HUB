"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type LiffSdk = {
  init: (config: { liffId: string }) => Promise<void>;
  isInClient: () => boolean;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  getAccessToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffSdk;
  }
}

const SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

/// Inside the LINE in-app browser the employee should not have to press anything. The SDK is only
/// loaded here, never on the desktop path.
export function LiffSignIn({ liffId }: { liffId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "link" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSdk(): Promise<LiffSdk | null> {
      if (window.liff) return window.liff;
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("load failed"));
        document.head.appendChild(script);
      });
      return window.liff ?? null;
    }

    async function run() {
      try {
        const liff = await loadSdk();
        if (!liff || cancelled) return;
        await liff.init({ liffId });
        if (!liff.isInClient()) return;
        setState("working");
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const accessToken = liff.getAccessToken();
        if (!accessToken) throw new Error("no access token");

        const response = await fetch("/api/auth/liff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const data = (await response.json()) as { state?: string; error?: string };
        if (!response.ok) {
          setState("error");
          setMessage(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
          return;
        }
        if (data.state === "pending") {
          setState("link");
          router.replace("/signin/pending");
          return;
        }
        router.replace("/");
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("เชื่อมต่อ LINE ไม่สำเร็จ ใช้ปุ่มด้านล่างเพื่อลองอีกครั้ง");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [liffId, router]);

  if (state === "idle") return null;

  return (
    <p
      role={state === "error" ? "alert" : "status"}
      className={`mb-3 rounded-lg p-3 text-sm ${
        state === "error" ? "bg-danger-soft text-danger" : "bg-accent-soft text-ink"
      }`}
    >
      {state === "working" ? "กำลังเข้าสู่ระบบด้วย LINE…" : null}
      {state === "link" ? "ส่งคำขอแล้ว รอฝ่ายบุคคลอนุมัติ" : null}
      {state === "error" ? message : null}
    </p>
  );
}
