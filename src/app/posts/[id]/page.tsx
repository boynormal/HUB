import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AttachmentGallery } from "@/components/attachment-gallery";
import { AcknowledgePanel } from "@/components/acknowledge-panel";
import { CommentSection, type CommentView } from "@/components/comment-section";
import { DeletePostButton } from "@/components/delete-post-button";
import { RestorePostButton } from "@/components/restore-post-button";
import { ShareLinkButton } from "@/components/share-link-button";
import { MarkRead } from "@/components/mark-read";
import { PriorityBadge, ReceiptBadge, TypeBadge } from "@/components/badges";
import { VersionPanel } from "@/components/version-panel";
import { isManualType } from "@/server/versions";
import { getActor, HttpError } from "@/server/auth/actor";
import { env } from "@/server/env";
import { loadLinkPreview, type LinkPreview } from "@/server/link-preview";
import { canViewPost } from "@/server/posts";
import { loadPostDetail, type PostDetail } from "@/server/post-detail";
import { shellData } from "@/server/shell";
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
    images: node.images,
    replies: toCommentViews(node.replies),
  }));
}

async function pageOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return env().APP_ORIGIN.replace(/\/$/, "");
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const hostname = host.split(",")[0]?.trim() ?? "";
  const proto = forwarded || (hostname.startsWith("localhost") || hostname.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${hostname}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const preview = await loadLinkPreview(id);
  if (!preview) return { title: "Hub ศูนย์กลางการสื่อสาร" };
  const origin = await pageOrigin();
  return {
    title: preview.title,
    description: preview.description,
    openGraph: {
      title: preview.title,
      description: preview.description,
      url: `${origin}/posts/${id}`,
      type: "article",
      images: preview.imageId ? [{ url: `${origin}/api/posts/${id}/preview-image` }] : [],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor || !(await canViewPost(actor, id))) {
    const preview = await loadLinkPreview(id);
    if (!preview) notFound();
    return <LimitedPreview preview={preview} postId={id} signedIn={actor !== null} />;
  }

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
      {post.deletedAt ? null : <MarkRead postId={post.id} alreadyRead={post.viewer.readAt !== null} />}

      <div className="mx-auto max-w-3xl">
      <nav className="mb-3 text-sm text-muted">
        <Link href={post.deletedAt ? "/settings/deleted" : "/"} className="hover:underline">
          {post.deletedAt ? "ประกาศที่ลบแล้ว" : "ฟีด"}
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

        {post.deletedAt ? (
          <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            ประกาศนี้ถูกซ่อนจากพนักงานแล้ว
          </p>
        ) : null}

        <h1 className="mt-3 text-[1.7rem] font-semibold leading-snug">{post.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {post.authorName}
            {post.authorDepartment ? ` · ${post.authorDepartment}` : ""}
            {post.publishedAt ? ` · ${formatThaiDateTime(post.publishedAt)}` : ""}
          </p>
          {post.deletedAt ? null : <ShareLinkButton path={`/posts/${post.id}`} title={post.title} />}
        </div>

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
          <section className="mt-5 min-w-0" aria-labelledby="attachments-heading">
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

        {post.viewer.canManage || post.viewer.canDelete ? (
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
              {post.viewer.canManage ? (
                <Link
                  href={`/compose?post=${post.id}`}
                  className="thumb-zone inline-flex items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium"
                >
                  แก้ไขประกาศ
                </Link>
              ) : null}
              {post.deletedAt && post.viewer.canDelete ? (
                <RestorePostButton postId={post.id} />
              ) : null}
              {!post.deletedAt && post.viewer.canDelete ? <DeletePostButton postId={post.id} /> : null}
            </div>
          </section>
        ) : null}
        </div>
      </article>

      {post.requiresConfirmation && !post.deletedAt ? (
        <div className="glass glass-thick glass-rim safe-bottom sticky bottom-16 z-10 mt-4 p-3 xl:bottom-4">
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

function LimitedPreview({
  preview,
  postId,
  signedIn,
}: {
  preview: LinkPreview;
  postId: string;
  signedIn: boolean;
}) {
  return (
    <main className="auth-screen mx-auto min-h-dvh max-w-xl px-4 py-8">
      <article className="hub-card overflow-hidden">
        {preview.imageId ? (
          <img
            src={`/api/posts/${postId}/preview-image`}
            alt=""
            className="max-h-80 w-full object-contain bg-surface-muted"
          />
        ) : null}
        <div className="p-5">
          <h1 className="text-xl font-semibold leading-snug">{preview.title}</h1>
          {preview.description ? (
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{preview.description}</p>
          ) : null}
          <p className="mt-4 text-sm text-muted">
            {signedIn
              ? "ประกาศนี้ไม่ได้ส่งถึงคุณ จึงอ่านเนื้อหาเต็มไม่ได้"
              : "เข้าสู่ระบบด้วยบัญชีพนักงานที่ได้รับประกาศนี้ จึงจะอ่านเนื้อหาเต็มได้"}
          </p>
          {signedIn ? null : (
            <Link
              href="/signin"
              className="thumb-zone mt-4 inline-flex items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </article>
    </main>
  );
}
