"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatThaiDateTime } from "@/server/time";

type Props = {
  postId: string;
  acknowledgedAt: string | null;
  deadline: string | null;
  isRecipient: boolean;
};

/// The acknowledgement bar sits in the thumb zone on mobile and stays visible while reading.
export function AcknowledgePanel({ postId, acknowledgedAt, deadline, isRecipient }: Props) {
  const router = useRouter();
  const [done, setDone] = useState(acknowledgedAt);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isRecipient) {
    return (
      <p className="rounded-lg border border-line bg-surface-muted p-3 text-sm text-muted">
        ประกาศนี้ไม่ได้ส่งถึงคุณ จึงไม่ต้องกดรับทราบ
      </p>
    );
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm font-medium text-success">
        <span aria-hidden="true">✓</span>
        รับทราบแล้ว {formatThaiDateTime(new Date(done))}
      </p>
    );
  }

  async function acknowledge() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || null }),
      });
      const data = (await response.json()) as { acknowledgedAt?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ ลองอีกครั้ง");
        return;
      }
      setDone(data.acknowledgedAt ?? new Date().toISOString());
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {deadline ? (
        <p className="text-sm text-muted">ต้องกดรับทราบภายใน {formatThaiDateTime(new Date(deadline))}</p>
      ) : null}
      {showNote ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">หมายเหตุ (ไม่บังคับ)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border border-line bg-surface p-2 text-[15px]"
            placeholder="เช่น รับทราบแล้ว จะดำเนินการวันจันทร์"
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="text-sm text-accent underline"
        >
          เพิ่มหมายเหตุ
        </button>
      )}
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={acknowledge}
        disabled={busy}
        className="thumb-zone w-full rounded-full bg-accent px-4 text-base font-semibold text-accent-ink shadow-card disabled:opacity-60"
      >
        {busy ? "กำลังบันทึก…" : "ฉันอ่านและรับทราบ"}
      </button>
    </div>
  );
}
