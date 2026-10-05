"use client";

import { useState } from "react";

export function ShareLinkButton({ path, title }: { path: string; title: string }) {
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}${path}`;
    const local = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    setNote(
      local
        ? "คัดลอกหรือแชร์ได้ แต่ลิงก์นี้ชี้มาที่เครื่องคุณ LINE จึงยังเห็นเป็นลิงก์เปล่า จนกว่าเว็บจะเปิดด้วยที่อยู่สาธารณะ"
        : null,
    );
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote("คัดลอกลิงก์แล้ว ส่งให้เพื่อนร่วมงานใน LINE ได้");
    } catch {
      setNote(url);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => void share()}
        className="thumb-zone inline-flex items-center rounded-full border border-line bg-surface px-4 text-sm font-medium"
      >
        แชร์ลิงก์
      </button>
      {note ? <span className="mt-1 max-w-xs text-xs text-muted">{note}</span> : null}
    </span>
  );
}
