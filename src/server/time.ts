export const APP_TIME_ZONE = "Asia/Bangkok";

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

function bangkokParts(date: Date): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    parts[part.type] = part.value;
  }
  return parts;
}

/// `29 ก.ย. 2026 14:35` in Asia/Bangkok, matching the format used across the plan.
export function formatThaiDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const parts = bangkokParts(value);
  const month = THAI_MONTHS[Number(parts.month) - 1] ?? "";
  return `${Number(parts.day)} ${month} ${parts.year} ${parts.hour}:${parts.minute}`;
}

export function formatThaiDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const parts = bangkokParts(value);
  const month = THAI_MONTHS[Number(parts.month) - 1] ?? "";
  return `${Number(parts.day)} ${month} ${parts.year}`;
}

/// Short relative label for lists. Falls back to an absolute date past a week.
export function formatRelativeThai(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "";
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "";
  const diffMs = now.getTime() - value.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} วันที่แล้ว`;
  return formatThaiDate(value);
}

export function deadlineLabel(deadline: Date | string | null | undefined, now: Date = new Date()): string {
  if (!deadline) return "";
  const value = typeof deadline === "string" ? new Date(deadline) : deadline;
  if (Number.isNaN(value.getTime())) return "";
  const diffMs = value.getTime() - now.getTime();
  if (diffMs < 0) return `เกินกำหนด ${formatThaiDateTime(value)}`;
  const hours = Math.floor(diffMs / 3600000);
  if (hours < 24) return `ครบกำหนดอีก ${Math.max(1, hours)} ชั่วโมง`;
  return `ครบกำหนด ${formatThaiDateTime(value)}`;
}
