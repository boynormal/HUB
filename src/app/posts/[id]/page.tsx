import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttachmentGallery } from "@/components/attachment-gallery";
import { AcknowledgePanel } from "@/components/acknowledge-panel";
import { CommentSection, type CommentView } from "@/components/comment-section";
import { MarkRead } from "@/components/mark-read";
import { PriorityBadge, ReceiptBadge, TypeBadge } from "@/components/badges";
import { VersionPanel } from "@/components/version-panel";
import { isManualType } from "@/server/versions";
import { HttpError } from "@/server/auth/actor";
import { loadPostDetail, type PostDetail } from "@/server/post-detail";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";
import type { CommentNode } from "@/server/comments";

function toCommentViews(nodes: CommentNode[]): CommentView[] {
  return nodes.map((node) => ({
    id: node.id,
    content: node.content,
    authorName: node.authorName,
    authorId: node.authorId,
    departmentName: node.departmentName,
    isPinned: node.isPinned,
    createdAt: node.createdAt.toISOString(),
    canDelete: node.canDelete,
    replies: toCommentViews(node.replies),
  }));
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor();
  const { id } = await params;

  let post: PostDetail;
  try {
    post = await loadPostDetail(actor, id);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  const shell = await shellData(actor);

  return (
    <AppShell {...shell}>
      <MarkRead postId={post.id} alreadyRead={post.viewer.readAt !== null} />

      <div className="mx-auto max-w-3xl">
      <nav className="mb-3 text-sm text-muted">
        <Link href="/" className="hover:underline">
          ฟีด
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/?topic=${post.topic.slug}`} className="hover:underline">
          {post.topic.name}
        </Link>
      </nav>

      <article className="hub-card overflow-hidden">
        <div
          className="px-5 py-3 text-sm font-semibold"
          style={{
            color: post.topic.color ?? "var(--hub-accent)",
            backgroundColor: `color-mix(in srgb, ${post.topic.color ?? "var(--hub-accent)"} 16%, transparent)`,
          }}
        >
          {post.topic.name}
        </div>
        <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge postType={post.postType} />
          <PriorityBadge priority={post.priority} />
          <ReceiptBadge status={post.viewer.status} />
        </div>

        <h1 className="mt-3 text-[1.7rem] font-semibold leading-snug">{post.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {post.authorName}
          {post.authorDepartment ? ` · ${post.authorDepartment}` : ""}
          {post.publishedAt ? ` · ${formatThaiDateTime(post.publishedAt)}` : ""}
        </p>

        {post.summary ? (
          <p className="mt-5 rounded-2xl bg-surface-muted p-4 text-[15px] leading-relaxed">{post.summary}</p>
        ) : null}

        <div
          className="post-body mx-auto mt-6 max-w-[40rem] text-[17px]"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/?tag=${tag.slug}`}
                className="rounded-md bg-surface-muted px-2 py-1 text-xs text-muted"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        ) : null}

        {post.attachments.length > 0 ? (
          <section className="mt-5" aria-labelledby="attachments-heading">
            <h2 id="attachments-heading" className="text-sm font-semibold">
              ไฟล์แนบ ({post.attachments.length})
            </h2>
            <AttachmentGallery files={post.attachments} />
          </section>
        ) : null}

        {isManualType(post.postType) ? (
          <VersionPanel
            postId={post.id}
            currentLabel={post.currentVersionLabel}
            canManage={post.viewer.canManage}
            versions={post.versions.map((edition) => ({
              id: edition.id,
              label: edition.label,
              title: edition.title,
              content: edition.content,
              isCurrent: edition.isCurrent,
              publishedAt: edition.publishedAt.toISOString(),
              files: edition.files,
            }))}
          />
        ) : null}

        {post.viewer.canManage ? (
          <section className="mt-5 rounded-lg border border-line bg-surface-muted p-3">
            <h2 className="text-sm font-semibold">สำหรับผู้ดูแลประกาศ</h2>
            <p className="mt-1 text-sm text-muted">
              ส่งถึง {post.stats.recipients} คน · อ่าน {post.stats.read} · รับทราบ{" "}
              {post.stats.acknowledged}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                href={`/posts/${post.id}/receipts`}
                className="thumb-zone inline-flex items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium"
              >
                ดูรายชื่อผู้รับ
              </Link>
              <Link
                href={`/compose?post=${post.id}`}
                className="thumb-zone inline-flex items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium"
              >
                แก้ไขประกาศ
              </Link>
            </div>
          </section>
        ) : null}
        </div>
      </article>

      {post.requiresConfirmation ? (
        <div className="glass glass-thick glass-rim safe-bottom sticky bottom-16 z-10 mt-4 p-3 lg:bottom-4">
          <AcknowledgePanel
            postId={post.id}
            acknowledgedAt={post.viewer.acknowledgedAt?.toISOString() ?? null}
            deadline={post.confirmationDeadline?.toISOString() ?? null}
            isRecipient={post.viewer.isRecipient}
          />
        </div>
      ) : null}

      <CommentSection
        postId={post.id}
        comments={toCommentViews(post.comments)}
        allowComments={post.allowComments}
      />
      </div>
    </AppShell>
  );
}
