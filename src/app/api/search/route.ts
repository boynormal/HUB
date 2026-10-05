import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { searchPosts, searchPostsBasic } from "@/server/search";
import { jsonError } from "@/server/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const term = new URL(request.url).searchParams.get("q") ?? "";
    // pg_trgm may be unavailable if the database owner cannot install extensions.
    const hits = await searchPosts(actor, term).catch(() => searchPostsBasic(actor, term));
    return NextResponse.json({ hits });
  } catch (error) {
    return jsonError(error);
  }
}
