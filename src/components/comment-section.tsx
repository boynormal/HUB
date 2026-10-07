"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageViewer } from "@/components/attachment-gallery";
import { Icon } from "@/components/icons";
import { mentionTokensToHtml, mentionsToPlainText, restoreMentions } from "@/server/mentions";
import { formatRelativeThai } from "@/server/time";

const COMMENT_IMAGE_LIMIT = 4;
const COMMENT_IMAGE_BYTES = 8 * 1024 * 1024;

export type CommentImageView = {
  id: string;
  fileName: string;
};

export type CommentView = {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  departmentName: string | null;
  isPinned: boolean;
  createdAt: string;
  canDelete: boolean;
  images: CommentImageView[];
  replies: CommentView[];
};

type MentionResult = {
  kind: string;
  id: string;
  label: string;
  hint: string;
  avatarUrl?: string | null;
};

const EMOJIS = [
  { glyph: "👍", label: "ถูกใจ" },
  { glyph: "❤️", label: "หัวใจ" },
  { glyph: "😊", label: "ยิ้ม" },
  { glyph: "🎉", label: "ฉลอง" },
  { glyph: "🙏", label: "ขอบคุณ" },
  { glyph: "✅", label: "เรียบร้อย" },
];

export function CommentSection({
  postId,
  comments,
  allowComments,
}: {
  postId: string;
  comments: CommentView[];
  allowComments: boolean;
}) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  return (
    <section aria-labelledby="comments-heading" className="mt-6">
      <h2 id="comments-heading" className="text-base font-semibold">
        ความคิดเห็น ({countAll(comments)})
      </h2>

      {allowComments ? (
        <CommentForm postId={postId} parentId={null} onDone={() => router.refresh()} />
      ) : (
        <p className="mt-2 rounded-lg bg-surface-muted p-3 text-sm text-muted">
          ประกาศนี้ปิดการแสดงความคิดเห็น
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {comments.map((comment) => (
          <li key={comment.id} id={`comment-${comment.id}`}>
            <CommentItem
              comment={comment}
              postId={postId}
              allowComments={allowComments}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
            />
          </li>
        ))}
      </ul>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">ยังไม่มีความคิดเห็น</p>
      ) : null}
    </section>
  );
}

function countAll(nodes: CommentView[]): number {
  return nodes.reduce((total, node) => total + 1 + countAll(node.replies), 0);
}

function CommentItem({
  comment,
  postId,
  allowComments,
  replyTo,
  setReplyTo,
  depth = 0,
}: {
  comment: CommentView;
  postId: string;
  allowComments: boolean;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  depth?: number;
}) {
  const router = useRouter();
  const [viewer, setViewer] = useState<number | null>(null);

  async function remove() {
    if (!window.confirm("ลบความคิดเห็นนี้?")) return;
    await fetch(`/api/comments/${comment.id}`, { method: "DELETE" });
    router.refresh();
  }

  const initial = comment.authorName.trim().slice(0, 1) || "•";

  return (
    <div className={depth > 0 ? "ms-4 border-s border-line ps-3" : ""}>
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {comment.authorName}
              {comment.isPinned ? <span className="ms-1">📌</span> : null}
            </p>
            <p className="truncate text-xs text-muted">
              {comment.departmentName ? `${comment.departmentName} · ` : ""}
              {formatRelativeThai(new Date(comment.createdAt))}
            </p>
          </div>
        </div>
        {comment.content.trim().length > 0 ? (
          <div
            className="post-body mt-2 text-[15px]"
            dangerouslySetInnerHTML={{ __html: mentionTokensToHtml(comment.content) }}
          />
        ) : null}
        {comment.images.length > 0 ? (
          <div className="scroll-plain mt-2 flex gap-2 overflow-x-auto">
            {comment.images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setViewer(index)}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-muted"
              >
                <img
                  src={`/api/attachments/${image.id}?inline=1`}
                  alt={image.fileName}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : null}
        {viewer !== null ? (
          <ImageViewer
            images={comment.images.map((image) => ({ id: image.id, fileName: image.fileName, kind: "image" }))}
            index={viewer}
            onIndex={setViewer}
            onClose={() => setViewer(null)}
          />
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {allowComments && depth < 2 ? (
            <button
              type="button"
              className="thumb-zone rounded-full border border-line px-4 text-sm font-medium"
              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
            >
              ตอบกลับ
            </button>
          ) : null}
          {comment.canDelete ? (
            <button
              type="button"
              className="thumb-zone rounded-full border border-line px-4 text-sm font-medium text-danger"
              onClick={remove}
            >
              ลบ
            </button>
          ) : null}
        </div>
        {replyTo === comment.id ? (
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onDone={() => {
              setReplyTo(null);
              router.refresh();
            }}
          />
        ) : null}
      </div>

      {comment.replies.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <li key={reply.id} id={`comment-${reply.id}`}>
              <CommentItem
                comment={reply}
                postId={postId}
                allowComments={allowComments}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                depth={depth + 1}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MentionFace({ result }: { result: MentionResult }) {
  if (result.kind === "all") {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#4a90e2] text-lg font-semibold text-white">
        @
      </span>
    );
  }
  if (result.avatarUrl && result.avatarUrl.startsWith("http")) {
    return (
      <img src={result.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
    );
  }
  const initial = result.label.trim().slice(0, 1) || "•";
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
      {initial}
    </span>
  );
}

function CommentForm({
  postId,
  parentId,
  onDone,
}: {
  postId: string;
  parentId: string | null;
  onDone: () => void;
}) {
  const [content, setContent] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionResult[]>([]);
  const [images, setImages] = useState<Array<{ key: string; file: File; url: string }>>([]);

  /// Mentions are inserted as tokens, so typing plain text never notifies anyone.
  async function lookupMentions(value: string, cursor: number) {
    const match = /@([^\s@]{0,30})$/.exec(value.slice(0, cursor));
    if (!match) {
      setMentions([]);
      return;
    }
    const response = await fetch(
      `/api/mentions?postId=${encodeURIComponent(postId)}&q=${encodeURIComponent(match[1])}`,
    );
    if (!response.ok) {
      setMentions([]);
      return;
    }
    const data = (await response.json()) as { results: MentionResult[] };
    setMentions(data.results.slice(0, 8));
  }

  function insertEmoji(glyph: string) {
    const el = field.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const next = `${content.slice(0, start)}${glyph}${content.slice(end)}`;
    setContent(next);
    const cursor = start + glyph.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  function insertMention(result: MentionResult) {
    setContent((current) => {
      const next = current.replace(
        /@([^\s@]{0,30})$/,
        `@[${result.label}](${result.kind}:${result.id}) `,
      );
      const cursor = mentionsToPlainText(next).length;
      requestAnimationFrame(() => {
        field.current?.focus();
        field.current?.setSelectionRange(cursor, cursor);
      });
      return next;
    });
    setMentions([]);
  }

  function addImages(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    if (images.length + picked.length > COMMENT_IMAGE_LIMIT) {
      setError("แนบได้ไม่เกิน 4 รูป");
    }
    const room = COMMENT_IMAGE_LIMIT - images.length;
    const next = picked.slice(0, Math.max(room, 0)).flatMap((file) => {
      if (!file.type.startsWith("image/")) {
        setError("ความคิดเห็นแนบได้เฉพาะรูปภาพ");
        return [];
      }
      if (file.size > COMMENT_IMAGE_BYTES) {
        setError("รูปใหญ่เกิน 8 MB");
        return [];
      }
      return [{ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) }];
    });
    setImages((current) => [...current, ...next]);
    if (picker.current) picker.current.value = "";
  }

  function removeImage(key: string) {
    setImages((current) => {
      const found = current.find((image) => image.key === key);
      if (found) URL.revokeObjectURL(found.url);
      return current.filter((image) => image.key !== key);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (content.trim().length === 0 && images.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("content", content);
      if (parentId) body.set("parentId", parentId);
      for (const image of images) body.append("images", image.file);
      const response = await fetch(`/api/posts/${postId}/comments`, { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "ส่งไม่สำเร็จ");
        return;
      }
      for (const image of images) URL.revokeObjectURL(image.url);
      setImages([]);
      setContent("");
      onDone();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <div className="mb-2 flex flex-wrap gap-2" aria-label="อิโมจิ">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji.glyph}
            type="button"
            aria-label={emoji.label}
            onClick={() => insertEmoji(emoji.glyph)}
            className="thumb-zone w-11 rounded-full border border-line bg-surface text-lg"
          >
            {emoji.glyph}
          </button>
        ))}
      </div>
      <div className="relative">
        <label className="sr-only" htmlFor={`comment-${parentId ?? "root"}`}>
          เขียนความคิดเห็น
        </label>
        <textarea
          ref={field}
          id={`comment-${parentId ?? "root"}`}
          value={mentionsToPlainText(content)}
          onChange={(event) => {
            const plain = event.target.value;
            const cursor = event.target.selectionStart ?? plain.length;
            setContent((current) => restoreMentions(plain, current));
            void lookupMentions(plain, cursor);
          }}
          rows={parentId ? 2 : 3}
          maxLength={4000}
          placeholder={parentId ? "ตอบกลับ…" : "เขียนความคิดเห็น พิมพ์ @ เพื่อกล่าวถึงคน"}
          className="w-full rounded-lg border border-line bg-surface p-3 text-[15px]"
        />
        {mentions.length > 0 ? (
          <ul
            className="absolute bottom-[calc(100%+0.35rem)] start-3 z-30 max-h-60 w-60 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[var(--shadow-float)]"
            role="listbox"
            aria-label="เลือกคนที่จะกล่าวถึง"
          >
            {mentions.map((result) => (
              <li key={`${result.kind}-${result.id}`}>
                <button
                  type="button"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertMention(result)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-surface-muted"
                >
                  <MentionFace result={result} />
                  <span className="min-w-0 truncate text-base">{result.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {images.length > 0 ? (
        <div className="scroll-plain mt-2 flex gap-2 overflow-x-auto">
          {images.map((image) => (
            <div key={image.key} className="relative h-24 w-24 shrink-0">
              <img src={image.url} alt={image.file.name} className="h-full w-full rounded-lg border border-line object-contain" />
              <button
                type="button"
                onClick={() => removeImage(image.key)}
                className="thumb-zone absolute end-1 top-1 rounded-full bg-surface px-2 text-xs font-semibold"
              >
                ลบ
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          ref={picker}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={(event) => addImages(event.target.files)}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          className="thumb-zone inline-flex items-center gap-2 rounded-full border border-line px-4 text-sm font-medium"
        >
          <Icon name="paperclip" className="h-4 w-4" /> แนบรูป
        </button>
        <button
          type="submit"
          disabled={busy || (content.trim().length === 0 && images.length === 0)}
          className="thumb-zone rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {busy ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
        </button>
      </div>
    </form>
  );
}
