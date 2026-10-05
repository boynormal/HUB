"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

type FileItem = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export function AttachmentGallery({ files }: { files: FileItem[] }) {
  const images = files.filter((file) => file.mimeType.startsWith("image/"));
  const others = files.filter((file) => !file.mimeType.startsWith("image/"));
  const [openId, setOpenId] = useState<string | null>(null);
  const open = images.find((file) => file.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="mt-2 space-y-3">
      {images.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                onClick={() => setOpenId(file.id)}
                className="block overflow-hidden rounded-xl border border-line bg-surface-muted"
              >
                <img
                  src={`/api/attachments/${file.id}?inline=1`}
                  alt={file.fileName}
                  className="block h-auto max-h-56 w-auto max-w-full object-contain sm:max-w-sm"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {others.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {others.map((file) => (
            <li key={file.id}>
              <a
                href={`/api/attachments/${file.id}`}
                className="thumb-zone flex items-center gap-3 rounded-2xl border border-line bg-surface-muted px-3 text-sm"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon name="paperclip" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{file.fileName}</span>
                  <span className="block text-xs text-muted">{formatBytes(file.fileSize)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={open.fileName}
          onClick={() => setOpenId(null)}
        >
          <button
            type="button"
            className="thumb-zone absolute end-4 top-4 rounded-full bg-surface px-4 text-sm font-medium"
            onClick={() => setOpenId(null)}
          >
            ปิด
          </button>
          <img
            src={`/api/attachments/${open.id}?inline=1`}
            alt={open.fileName}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
