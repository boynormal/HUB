import { prisma } from "@/server/db";
import { loadLinkPreview } from "@/server/link-preview";
import { readAttachment } from "@/server/attachments";

/// The one image chat apps may fetch without a login. No other file is served here.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const preview = await loadLinkPreview(id);
  if (!preview?.imageId) return new Response(null, { status: 404 });

  const file = await prisma.communicationAttachment.findFirst({
    where: { id: preview.imageId, deletedAt: null, mimeType: { startsWith: "image/" } },
    select: { storedName: true, mimeType: true },
  });
  if (!file) return new Response(null, { status: 404 });

  const bytes = await readAttachment(file.storedName);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": "inline",
      "Cache-Control": "public, max-age=300",
    },
  });
}
