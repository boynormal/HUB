import Link from "next/link";
import type { FeedCard } from "@/server/posts";
import { deadlineLabel, formatRelativeThai } from "@/server/time";
import { PriorityBadge, ReceiptBadge, TypeBadge } from "@/components/badges";
import { Icon } from "@/components/icons";

/// Feed cards stay short: the summary here, the full text on the detail screen.
export function PostCard({ card }: { card: FeedCard }) {
  const needsAction = card.requiresConfirmation && card.viewerStatus !== "ACKNOWLEDGED";
  const topicColor = card.topicColor ?? "var(--hub-accent)";
  const summary = card.summary?.trim() ?? "";
  const showSummary = summary.length > 0 && summary !== card.title.trim();
  return (
    <article
      className={`hub-card overflow-hidden ${
        card.viewerStatus === "OVERDUE" ? "ring-1 ring-[var(--hub-red)]" : ""
      }`}
    >
      <div className="px-4 pt-4" style={{ borderTop: `4px solid ${topicColor}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
              style={{
                color: topicColor,
                backgroundColor: `color-mix(in srgb, ${topicColor} 16%, transparent)`,
              }}
            >
              {card.topicName}
            </span>
            <TypeBadge postType={card.postType} />
            <PriorityBadge priority={card.priority} />
            {card.isPinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                <Icon name="pin" className="h-3.5 w-3.5" /> ปักหมุด
              </span>
            ) : null}
          </div>
          <time className="shrink-0 text-xs text-muted">{formatRelativeThai(card.publishedAt)}</time>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">
              <Link href={`/posts/${card.id}`} className="hover:text-accent">
                {card.title}
              </Link>
            </h2>
            <p className="mt-1 text-xs text-muted">{card.authorName}</p>
            {showSummary ? (
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{summary}</p>
            ) : null}
            {card.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.tags.map((tag) => (
                  <Link
                    key={tag.slug}
                    href={`/?tag=${tag.slug}`}
                    className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted hover:text-ink"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {card.images.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-2 sm:w-40 sm:flex-col">
              {card.images.map((image) => (
                <img
                  key={image.id}
                  src={`/api/attachments/${image.id}?inline=1`}
                  alt={image.fileName}
                  className="block h-auto max-h-40 w-auto max-w-full rounded-xl object-contain sm:w-40"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-xs text-muted">
          <Stat icon="eye" label={`อ่าน ${card.readCount}/${card.recipientCount}`} />
          {card.requiresConfirmation ? (
            <Stat icon="check" label={`รับทราบ ${card.acknowledgedCount}/${card.recipientCount}`} />
          ) : null}
          <Stat icon="message" label={String(card.commentCount)} />
          {card.attachmentCount > 0 ? (
            <Stat icon="paperclip" label={String(card.attachmentCount)} />
          ) : null}
          <ReceiptBadge status={card.viewerStatus} />
          {card.confirmationDeadline ? (
            <span className={`text-xs font-medium ${card.viewerStatus === "OVERDUE" ? "text-danger" : "text-muted"}`}>
              {deadlineLabel(card.confirmationDeadline)}
            </span>
          ) : null}
        </div>
        <Link
          href={`/posts/${card.id}`}
          className={`thumb-zone inline-flex w-full items-center justify-center rounded-full px-4 text-sm font-semibold sm:w-auto ${
            needsAction ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink"
          }`}
        >
          {needsAction ? "อ่านและรับทราบ" : "เปิดอ่าน"}
        </Link>
      </div>
    </article>
  );
}

function Stat({ icon, label }: { icon: "eye" | "check" | "message" | "paperclip"; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5">
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
