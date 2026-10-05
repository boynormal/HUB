"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ImageViewer } from "@/components/attachment-gallery";
import type { FeedCard } from "@/server/posts";

type Photo = FeedCard["images"][number];

export function FeedMedia({ images }: { images: FeedCard["images"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const onlyVideo = images.length === 1 && images[0].kind === "video";

  if (onlyVideo) {
    const video = images[0];
    return (
      <video
        src={`/api/attachments/${video.id}?inline=1`}
        controls
        playsInline
        preload="metadata"
        className="mt-3 max-h-[32rem] w-full bg-black"
      >
        {video.fileName}
      </video>
    );
  }

  return (
    <div className="mt-3 bg-black/5">
      <PhotoCollage photos={images} onOpen={setOpenIndex} />
      {openIndex !== null
        ? createPortal(
            <ImageViewer
              images={images}
              index={openIndex}
              onIndex={setOpenIndex}
              onClose={() => setOpenIndex(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function PhotoCollage({ photos, onOpen }: { photos: Photo[]; onOpen: (index: number) => void }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <button type="button" className="block w-full" onClick={() => onOpen(0)}>
      <MediaThumb item={photos[0]} className="max-h-[32rem] w-full object-contain" />
      </button>
    );
  }

  const shown = photos.slice(0, 5);
  const extra = photos.length - shown.length;

  if (shown.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {shown.map((photo, index) => (
          <PhotoTile key={photo.id} photo={photo} className="aspect-[4/5]" onOpen={() => onOpen(index)} />
        ))}
      </div>
    );
  }

  if (shown.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        <PhotoTile photo={shown[0]} className="row-span-2 h-full min-h-40" onOpen={() => onOpen(0)} />
        <PhotoTile photo={shown[1]} className="aspect-square" onOpen={() => onOpen(1)} />
        <PhotoTile photo={shown[2]} className="aspect-square" onOpen={() => onOpen(2)} />
      </div>
    );
  }

  if (shown.length === 4) {
    return (
      <div className="grid grid-cols-2 gap-0.5">
        {shown.map((photo, index) => (
          <PhotoTile key={photo.id} photo={photo} className="aspect-square" onOpen={() => onOpen(index)} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-0.5">
      <div className="grid grid-cols-2 gap-0.5">
        {shown.slice(0, 2).map((photo, index) => (
          <PhotoTile key={photo.id} photo={photo} className="aspect-[4/3]" onOpen={() => onOpen(index)} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        {shown.slice(2).map((photo, index) => (
          <PhotoTile
            key={photo.id}
            photo={photo}
            className="aspect-square"
            extra={index === 2 ? extra : 0}
            onOpen={() => onOpen(index + 2)}
          />
        ))}
      </div>
    </div>
  );
}

function MediaThumb({ item, className }: { item: Photo; className: string }) {
  if (item.kind === "video") {
    return (
      <span className="relative block h-full w-full bg-black">
        <video
          src={`/api/attachments/${item.id}?inline=1`}
          muted
          playsInline
          preload="metadata"
          className={`pointer-events-none ${className}`}
        />
        <span className="absolute inset-0 grid place-items-center text-3xl text-white" aria-hidden="true">
          ▶
        </span>
      </span>
    );
  }
  return <img src={`/api/attachments/${item.id}?inline=1`} alt={item.fileName} className={className} />;
}

function PhotoTile({
  photo,
  className,
  extra = 0,
  onOpen,
}: {
  photo: Photo;
  className: string;
  extra?: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`relative block overflow-hidden bg-surface-muted ${className}`}>
      <MediaThumb item={photo} className="h-full max-h-full min-h-0 w-full max-w-full min-w-0 object-contain" />
      {extra > 0 ? (
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-2xl font-semibold text-white">
          +{extra}
        </span>
      ) : null}
    </button>
  );
}
