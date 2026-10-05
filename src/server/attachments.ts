import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";
import { HttpError } from "@/server/auth/actor";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/// Extension and MIME must both be on the list. A mismatch is rejected.
const ALLOWED: Array<{ ext: string; mimes: string[] }> = [
  { ext: ".pdf", mimes: ["application/pdf"] },
  { ext: ".doc", mimes: ["application/msword"] },
  {
    ext: ".docx",
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  { ext: ".xls", mimes: ["application/vnd.ms-excel"] },
  {
    ext: ".xlsx",
    mimes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  { ext: ".csv", mimes: ["text/csv", "application/csv"] },
  { ext: ".png", mimes: ["image/png"] },
  { ext: ".jpg", mimes: ["image/jpeg"] },
  { ext: ".jpeg", mimes: ["image/jpeg"] },
  { ext: ".webp", mimes: ["image/webp"] },
  { ext: ".gif", mimes: ["image/gif"] },
  { ext: ".mp4", mimes: ["video/mp4"] },
  { ext: ".zip", mimes: ["application/zip", "application/x-zip-compressed"] },
];

export function validateUpload(fileName: string, mimeType: string, size: number): void {
  if (size <= 0) throw new HttpError(400, "ไฟล์ว่าง");
  if (size > MAX_FILE_BYTES) throw new HttpError(413, "ไฟล์ใหญ่เกิน 25 MB");
  const ext = path.extname(fileName).toLowerCase();
  const rule = ALLOWED.find((entry) => entry.ext === ext);
  if (!rule) throw new HttpError(415, `ไม่รองรับไฟล์ชนิด ${ext || "ไม่ทราบ"}`);
  if (!rule.mimes.includes(mimeType.toLowerCase())) {
    throw new HttpError(415, "ชนิดไฟล์กับนามสกุลไม่ตรงกัน");
  }
}

function storageRoot(): string {
  const configured = env().FILE_STORAGE_PATH;
  return configured.length > 0 ? configured : path.join(process.cwd(), "attachments");
}

/// Files live outside the web root. Downloads always go through an API route that checks access.
export async function saveAttachment(fileName: string, bytes: Buffer): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  const storedName = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  const target = path.join(storageRoot(), storedName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return storedName;
}

export async function readAttachment(storedName: string): Promise<Buffer> {
  const root = path.resolve(storageRoot());
  const target = path.resolve(root, storedName);
  // Guards against a stored name such as ../../secret
  if (!target.startsWith(root + path.sep)) throw new HttpError(400, "เส้นทางไฟล์ไม่ถูกต้อง");
  return readFile(target);
}

export function fileChecksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
