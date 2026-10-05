import { prisma } from "@/server/db";
import { toPlainText } from "@/server/sanitize";

export type LinkPreview = {
  title: string;
  description: string;
  imageId: string | null;
};

/// Public card for chat apps. Only a published post, and only a short text plus one image.
export async function loadLinkPreview(postId: string): Promise<LinkPreview | null> {
  const post = await prisma.communicationPost.findFirst({
    where: { id: postId, deletedAt: null, status: "PUBLISHED" },
    select: {
      title: true,
      summary: true,
      content: true,
      versions: { where: { isCurrent: true }, select: { id: true }, take: 1 },
      attachments: {
        where: { deletedAt: null, mimeType: { startsWith: "image/" } },
        select: { id: true, postVersionId: true, storedName: true, mimeType: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!post) return null;

  const currentId = post.versions[0]?.id ?? null;
  const image = post.attachments.find((file) =>
    currentId ? file.postVersionId === currentId || file.postVersionId === null : file.postVersionId === null,
  );
  const summary = post.summary?.trim() ?? "";
  const description =
    summary && summary !== post.title.trim() ? toPlainText(summary, 140) : toPlainText(post.content, 140);

  return {
    title: post.title,
    description,
    imageId: image?.id ?? null,
  };
}
