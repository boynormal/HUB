import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/actor";
import { loadFeed } from "@/server/feed";
import { jsonError, pagination } from "@/server/http";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const { take, skip } = pagination(url, 10, 50);
    const feed = await loadFeed(
      actor,
      {
        topicSlug: url.searchParams.get("topic"),
        tagSlug: url.searchParams.get("tag"),
        priority: url.searchParams.get("priority"),
        query: url.searchParams.get("q"),
      },
      { latestTake: take, latestSkip: skip },
    );
    return NextResponse.json(feed);
  } catch (error) {
    return jsonError(error);
  }
}
