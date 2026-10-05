"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatThaiDateTime } from "@/server/time";

export type VersionView = {
  id: string;
  label: string;
  title: string;
  content: string;
  isCurrent: boolean;
  publishedAt: string;
  files: Array<{ id: string; fileName: string; fileSize: number }>;
};

const ALLOWED = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".zip",
]);

/// Past editions stay readable. Publishing a new one does not clear acknowledgements.
export function VersionPanel({
  postId,
  currentLabel,
  versions,
  canManage,
}: {
  postId: string;
  currentLabel: string;
  versions: VersionView[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const history = versions.length
    ? versions
    : [
        {
          id: "current",
          label: currentLabel,
          title: "",
          content: "",
          isCurrent: true,
          publishedAt: "",
          files: [],
        },
      ];

  function queueFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const file of list) {
      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
      if (!ALLOWED.has(ext)) {
        setError(`ไม่รองรับไฟล์ ${file.name}`);
        return;
      }
      if (!file.type) {
        setError(`${file.name} ไม่ระบุชนิดไฟล์`);
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError(`${file.name} ใหญ่เกิน 25 MB`);
        return;
      }
      next.push(file);
    }
    setError(null);
    setFiles((current) => [...current, ...next]);
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          title,
          content: plainToHtml(content),
        }),
      });
      const created = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !created.id) {
        setError(created.error ?? "ออกเวอร์ชันไม่สำเร็จ");
        return;
      }
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        body.append("versionId", created.id);
        const uploaded = await fetch(`/api/posts/${postId}/attachments`, { method: "POST", body });
        if (!uploaded.ok) {
          const data = (await uploaded.json()) as { error?: string };
          setError(data.error ?? `อัปโหลด ${file.name} ไม่สำเร็จ`);
          return;
        }
      }
      setOpen(false);
      setFiles([]);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5" aria-labelledby="versions-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="versions-heading" className="text-sm font-semibold">
          เวอร์ชัน
        </h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
          ปัจจุบัน {currentLabel}
        </span>
        {canManage ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="thumb-zone ms-auto inline-flex items-center rounded-full border border-line px-3 text-sm font-medium"
          >
            {open ? "ปิดฟอร์ม" : "ออกเวอร์ชันใหม่"}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted">ฉบับเก่ายังเปิดอ่านได้ การรับทราบเดิมไม่ถูกล้าง</p>

      {open ? (
        <form onSubmit={publish} className="mt-3 space-y-3 rounded-2xl border border-line bg-surface-muted p-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">ป้ายเวอร์ชันใหม่</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              placeholder="2.0"
              className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">หัวเรื่อง</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">เนื้อหาฉบับนี้</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              rows={6}
              className="w-full rounded-lg border border-line bg-surface p-3 text-[15px]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">ไฟล์ของเวอร์ชันนี้</span>
            <input
              type="file"
              multiple
              onChange={(event) => {
                queueFiles(event.target.files);
                event.target.value = "";
              }}
              className="block w-full text-sm"
            />
          </label>
          {files.length > 0 ? (
            <ul className="text-sm text-muted">
              {files.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="thumb-zone inline-flex items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {busy ? "กำลังบันทึก…" : "บันทึกเวอร์ชันใหม่"}
          </button>
        </form>
      ) : null}

      <ul className="mt-3 space-y-2">
        {[...history].reverse().map((edition) => (
          <li key={edition.id} className="rounded-2xl border border-line p-3">
            <p className="text-sm font-semibold">
              เวอร์ชัน {edition.label}
              {edition.isCurrent || edition.id === "current" ? " · ปัจจุบัน" : ""}
            </p>
            {edition.publishedAt ? (
              <p className="text-xs text-muted">{formatThaiDateTime(edition.publishedAt)}</p>
            ) : null}
            {edition.id !== "current" && !edition.isCurrent ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-accent">เปิดอ่านฉบับนี้</summary>
                <div
                  className="post-body mt-2 text-[15px]"
                  dangerouslySetInnerHTML={{ __html: edition.content }}
                />
                {edition.files.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {edition.files.map((file) => (
                      <li key={file.id}>
                        <a href={`/api/attachments/${file.id}`} className="text-sm text-accent underline">
                          {file.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function plainToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  return blocks
    .map((block) => `<p>${block.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br />")}</p>`)
    .join("");
}
