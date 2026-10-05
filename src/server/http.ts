import { NextResponse } from "next/server";
import { HttpError } from "@/server/auth/actor";

export function jsonError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "ระบบขัดข้อง ลองอีกครั้ง" }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }
}

/// Keeps list endpoints from returning the whole table.
export function pagination(url: URL, defaultTake = 20, maxTake = 100) {
  const take = Math.min(maxTake, Math.max(1, Number(url.searchParams.get("take") ?? defaultTake)));
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? 0));
  return { take: Number.isFinite(take) ? take : defaultTake, skip: Number.isFinite(skip) ? skip : 0 };
}
