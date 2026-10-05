import { PRIORITY_LABEL, POST_TYPE_LABEL, STATUS_LABEL } from "@/server/notifications";
import type { ReceiptStatus } from "@/server/reminders";

/// Status is always a word plus a mark, so the meaning survives without color.
const PRIORITY_STYLE: Record<string, { className: string; mark: string }> = {
  NORMAL: { className: "text-muted bg-surface-muted", mark: "" },
  INFO: { className: "text-muted bg-surface-muted", mark: "" },
  IMPORTANT: { className: "text-amber bg-amber-soft", mark: "!" },
  URGENT: { className: "text-orange bg-orange-soft", mark: "!!" },
  CRITICAL: { className: "text-danger bg-danger-soft", mark: "!!!" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.NORMAL;
  if (priority === "NORMAL") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      <span aria-hidden="true">{style.mark}</span>
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}

const RECEIPT_STYLE: Record<ReceiptStatus, { label: string; className: string; mark: string }> = {
  UNREAD: { label: "ยังไม่อ่าน", className: "text-accent bg-accent-soft", mark: "●" },
  READ: { label: "อ่านแล้ว", className: "text-muted bg-surface-muted", mark: "◐" },
  ACKNOWLEDGED: { label: "รับทราบแล้ว", className: "text-success bg-success-soft", mark: "✓" },
  OVERDUE: { label: "เกินกำหนด", className: "text-danger bg-danger-soft", mark: "!" },
};

export function ReceiptBadge({ status }: { status: ReceiptStatus }) {
  const style = RECEIPT_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.className}`}
    >
      <span aria-hidden="true">{style.mark}</span>
      {style.label}
    </span>
  );
}

export function TypeBadge({ postType }: { postType: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-muted">
      {POST_TYPE_LABEL[postType] ?? postType}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "PUBLISHED"
      ? "text-success bg-success-soft"
      : status === "SCHEDULED"
        ? "text-accent bg-accent-soft"
        : status === "DRAFT"
          ? "text-muted bg-surface-muted"
          : "text-muted bg-surface-muted";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function TopicChip({ name, color }: { name: string; color?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color ?? "currentColor" }}
      />
      {name}
    </span>
  );
}
