import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PostComposer, type ComposerDraft } from "@/components/post-composer";
import { HttpError } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { loadPostDetail, type PostDetail } from "@/server/post-detail";
import { PERMISSIONS, hasPermission, isCommunicationAdmin } from "@/server/rbac";
import { requirePageActor, shellData } from "@/server/shell";

export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string }>;
}) {
  const actor = await requirePageActor();
  const { post } = await searchParams;
  if (!hasPermission(actor, PERMISSIONS.create) && !isCommunicationAdmin(actor)) {
    redirect("/");
  }

  const [shell, topics, tags, branches, departments, positions, groups, activeEmployees] =
    await Promise.all([
      shellData(actor),
      prisma.communicationTopic.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, color: true },
        orderBy: { name: "asc" },
      }),
      prisma.communicationTag.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.position.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.group.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
    ]);

  let draft: ComposerDraft | null = null;
  if (post) {
    try {
      const detail = await loadPostDetail(actor, post);
      if (!detail.viewer.canManage) redirect(`/posts/${post}`);
      draft = toDraft(detail);
    } catch (error) {
      if (error instanceof HttpError) notFound();
      throw error;
    }
  }

  return (
    <AppShell {...shell}>
      <PostComposer
        draft={draft}
        topics={topics}
        tags={tags}
        branches={branches}
        departments={departments}
        positions={positions}
        groups={groups}
        activeEmployees={activeEmployees}
        canPublish={
          hasPermission(actor, PERMISSIONS.publish) || isCommunicationAdmin(actor)
        }
      />
    </AppShell>
  );
}

function toDraft(detail: PostDetail): ComposerDraft {
  return {
    id: detail.id,
    status: detail.status,
    topicId: detail.topic.id,
    postType: detail.postType,
    priority: detail.priority,
    title: detail.title,
    content: htmlToComposerText(detail.content),
    tagIds: detail.tags.map((tag) => tag.id),
    targets: detail.targets,
    requiresConfirmation: detail.requiresConfirmation,
    confirmationDeadline: toBangkokInput(detail.confirmationDeadline),
    scheduledAt: toBangkokInput(detail.scheduledAt),
    expiresAt: toBangkokInput(detail.expiresAt),
    allowComments: detail.allowComments,
    attachments: detail.attachments.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      fileSize: file.fileSize,
    })),
  };
}

function htmlToComposerText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toBangkokInput(date: Date | null): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
}
