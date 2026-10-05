"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

type FileItem = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export function AttachmentGallery({ files }: { files: FileItem[] }) {
  const images = files
    .filter((file) => file.mimeType.startsWith("image/") || file.mimeType.startsWith("video/"))
    .map((file) => ({
      ...file,
      kind: file.mimeType.startsWith("video/") ? ("video" as const) : ("image" as const),
    }));
  const others = files.filter(
    (file) => !file.mimeType.startsWith("image/") && !file.mimeType.startsWith("video/"),
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = images.findIndex((file) => file.id === openId);
  const open = openIndex >= 0 ? images[openIndex] : null;

  return (
    <div className="mt-2 space-y-3">
      {images.length > 0 ? (
        <ul className="scroll-plain flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto overscroll-x-contain">
          {images.map((file) => (
            <li key={file.id} className="h-36 w-36 shrink-0">
              <button
                type="button"
                onClick={() => setOpenId(file.id)}
                className="block h-full w-full overflow-hidden rounded-xl border border-line bg-surface-muted"
              >
                <MediaPreview id={file.id} fileName={file.fileName} kind={file.kind} />
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

      {open
        ? createPortal(
            <ImageViewer
              images={images}
              index={openIndex}
              onIndex={(index) => setOpenId(images[index]?.id ?? null)}
              onClose={() => setOpenId(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

export function MediaPreview({
  id,
  fileName,
  kind,
}: {
  id: string;
  fileName: string;
  kind?: "image" | "video";
}) {
  if (kind === "video") {
    return (
      <span className="relative block h-full w-full bg-black">
        <video
          src={`/api/attachments/${id}?inline=1`}
          muted
          playsInline
          preload="metadata"
          className="pointer-events-none h-full w-full object-contain"
        />
        <span className="absolute inset-0 grid place-items-center text-2xl text-white" aria-hidden="true">
          ▶
        </span>
      </span>
    );
  }
  return (
    <img src={`/api/attachments/${id}?inline=1`} alt={fileName} className="h-full w-full object-contain" />
  );
}

export function ImageViewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: { id: string; fileName: string; kind?: "image" | "video" }[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [image.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && index < images.length - 1) onIndex(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, index, onClose, onIndex]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      setZoom((level) => clamp(level + (event.deltaY < 0 ? 0.15 : -0.15), 1, 4));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [image.id]);

  if (!image) return null;
  const percent = `${Math.round(zoom * 100)}%`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={image.fileName}>
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-sm">
        <span className="shrink-0 text-white/80">
          {index + 1} / {images.length}
        </span>
        <span className="min-w-0 flex-1 truncate">{image.fileName}</span>
        <span className="shrink-0 text-white/80">{percent}</span>
        <a
          href={`/api/attachments/${image.id}`}
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"
          aria-label="ดาวน์โหลด"
        >
          <DownloadIcon />
        </a>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/15"
          aria-label="ปิด"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div
        ref={stage}
        className={`grid min-h-0 w-full flex-1 place-items-center ${zoom === 1 ? "overflow-hidden" : "scroll-plain overflow-auto"}`}
        onDoubleClick={() => setZoom((level) => (level === 1 ? 2.5 : 1))}
        onPointerDown={(event) => {
          if (zoom <= 1 || !stage.current) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: stage.current.scrollLeft,
            top: stage.current.scrollTop,
          };
          stage.current.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || !stage.current) return;
          stage.current.scrollLeft = start.left - (event.clientX - start.x);
          stage.current.scrollTop = start.top - (event.clientY - start.y);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        {image.kind === "video" ? (
          <video
            key={image.id}
            src={`/api/attachments/${image.id}?inline=1`}
            controls
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          <img
            src={`/api/attachments/${image.id}?inline=1`}
            alt={image.fileName}
            draggable={false}
            style={zoom === 1 ? undefined : { width: `${zoom * 100}%`, height: "auto", maxWidth: "none" }}
            className={
              zoom === 1
                ? "h-full max-h-full min-h-0 w-full max-w-full min-w-0 object-contain"
                : "h-auto w-auto max-w-none object-contain"
            }
          />
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 px-4 pb-4 pt-3">
        <div className="flex items-center gap-2">
          <RoundButton label="ภาพก่อนหน้า" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <Chevron direction="left" />
          </RoundButton>
          <RoundButton label="ย่อ" disabled={zoom <= 1} onClick={() => setZoom((level) => clamp(level - 0.5, 1, 4))}>
            <ZoomIcon minus />
          </RoundButton>
          <span className="grid h-11 min-w-16 place-items-center rounded-full bg-white/20 px-3 text-sm">{percent}</span>
          <RoundButton label="ขยาย" disabled={zoom >= 4} onClick={() => setZoom((level) => clamp(level + 0.5, 1, 4))}>
            <ZoomIcon />
          </RoundButton>
          <RoundButton label="ภาพถัดไป" disabled={index >= images.length - 1} onClick={() => onIndex(index + 1)}>
            <Chevron direction="right" />
          </RoundButton>
        </div>
        <p className="text-xs text-white/70">Scroll เพื่อซูม · ดับเบิลคลิกเพื่อซูม 2.5× · ลากเพื่อเลื่อนภาพ</p>
        {images.length > 1 ? (
          <ul className="scroll-plain flex max-w-full gap-2 overflow-x-auto">
            {images.map((item, itemIndex) => (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  aria-label={item.fileName}
                  aria-current={itemIndex === index ? "true" : undefined}
                  onClick={() => onIndex(itemIndex)}
                  className={`block h-16 w-16 overflow-hidden rounded-lg border bg-white ${
                    itemIndex === index ? "border-white" : "border-transparent opacity-70"
                  }`}
                >
                  <MediaPreview id={item.id} fileName="" kind={item.kind} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function RoundButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d={direction === "left" ? "m14 6-6 6 6 6" : "m10 6 6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ZoomIcon({ minus = false }: { minus?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d={minus ? "m16 16 4 4M8.5 11h5" : "m16 16 4 4M11 8.5v5M8.5 11h5"} strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 4v10M8 10l4 4 4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
