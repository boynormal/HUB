import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PriorityBadge, ReceiptBadge } from "@/components/badges";
import { searchPosts, searchPostsBasic } from "@/server/search";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await requirePageActor();
  const { q = "" } = await searchParams;
  const shell = await shellData(actor);
  // Falls back to a plain contains search when pg_trgm is not installed.
  const hits = q.trim()
    ? await searchPosts(actor, q).catch(() => searchPostsBasic(actor, q))
    : [];

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">ค้นหา</h1>
      {q.trim() ? (
        <p className="mt-1 text-sm text-muted">
          คำค้น &ldquo;{q}&rdquo; · {hits.length} ผลลัพธ์
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">พิมพ์คำค้นในช่องด้านบน</p>
      )}

      {q.trim() && hits.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">
          ไม่พบประกาศที่ตรงกับคำค้นนี้
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {hits.map((hit) => (
          <li key={hit.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{hit.topicName}</span>
              <PriorityBadge priority={hit.priority} />
              <ReceiptBadge
                status={
                  hit.viewerAcknowledged ? "ACKNOWLEDGED" : hit.viewerRead ? "READ" : "UNREAD"
                }
              />
              <span className="ms-auto">{formatThaiDateTime(hit.publishedAt)}</span>
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              <Link href={`/posts/${hit.id}`} className="hover:underline">
                {hit.title}
              </Link>
            </h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{hit.snippet}</p>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
