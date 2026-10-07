"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
};

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function saveSubscription(): Promise<string | null> {
  const config = (await fetch("/api/push/vapid").then((response) => response.json())) as {
    configured?: boolean;
    publicKey?: string;
  };
  if (!config.configured || !config.publicKey) return "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าการแจ้งเตือน";
  const ready = await navigator.serviceWorker.ready;
  const existing = await ready.pushManager.getSubscription();
  const subscription =
    existing ??
    (await ready.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    }));
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!response.ok) return "บันทึกการแจ้งเตือนไม่สำเร็จ";
  return null;
}

/// Offers a home-screen install and a one-time phone notification permission.
export function PhoneAlerts() {
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setStandalone(installed);
    setIos(apple);
    const current = "Notification" in window ? Notification.permission : "unsupported";
    setPermission(current);
    const later = sessionStorage.getItem("hub-phone-later") === "1";
    setDismissed(later || current === "granted");
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").then(() => {
        if (current === "granted") {
          void saveSubscription().then((error) => {
            if (!error) return;
            setMessage(error);
            setDismissed(false);
          });
        }
      });
    }
    function onPrompt(event: Event) {
      event.preventDefault();
      setInstall(event as InstallPrompt);
      setDismissed(false);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const needsIosInstall = ios && !standalone;
  const needsInstall = !standalone && install !== null;
  const needsNotify = permission === "default" && (!ios || standalone);
  if (dismissed || (!needsIosInstall && !needsInstall && !needsNotify && !message)) return null;

  async function enable() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      setMessage("ยังไม่เปิดการแจ้งเตือนในเครื่อง");
      return;
    }
    const error = await saveSubscription();
    setMessage(error ?? "เปิดการแจ้งเตือนแล้ว");
    if (!error) setDismissed(true);
  }

  return (
    <section className="bar fixed inset-x-3 z-30 rounded-[20px] p-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] xl:bottom-4 xl:end-4 xl:start-auto xl:max-w-sm">
      <p className="text-sm font-semibold">ใช้ Hub บนหน้าจอมือถือ</p>
      {needsIosInstall ? (
        <p className="mt-1 text-sm text-muted">
          เปิดหน้านี้ใน Safari แล้วกดแชร์ และเลือกเพิ่มไปที่หน้าจอโฮม จากนั้นเปิด Hub จากไอคอนแล้วกดเปิดการแจ้งเตือน
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">ติดตั้งแล้วเปิดการแจ้งเตือนครั้งเดียว ประกาศใหม่จะเด้งบนหน้าจอ</p>
      )}
      {message ? <p className="mt-1 text-sm text-muted">{message}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {needsInstall ? (
          <button
            type="button"
            onClick={() => void install?.prompt().then(() => setInstall(null))}
            className="thumb-zone rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
          >
            ติดตั้ง Hub
          </button>
        ) : null}
        {needsNotify ? (
          <button
            type="button"
            onClick={() => void enable()}
            className="thumb-zone rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
          >
            เปิดการแจ้งเตือน
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("hub-phone-later", "1");
            setDismissed(true);
          }}
          className="thumb-zone rounded-full border border-line px-4 text-sm font-medium"
        >
          ไว้ทีหลัง
        </button>
      </div>
    </section>
  );
}
