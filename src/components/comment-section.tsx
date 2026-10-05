"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mentionTokensToHtml, mentionsToPlainText, restoreMentions } from "@/server/mentions";
import { formatRelativeThai } from "@/server/time";

export type CommentView = {
  id: string;
  content: string;
  authorName: string;
  authorId: string;
  departmentName: string | null;
  isPinned: boolean;
  createdAt: string;
  canDelete: boolean;
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
        <div
          className="post-body mt-2 text-[15px]"
          dangerouslySetInnerHTML={{ __html: mentionTokensToHtml(comment.content) }}
        />
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionResult[]>([]);

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (content.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "ส่งไม่สำเร็จ");
        return;
      }
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
      {error ? (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy || content.trim().length === 0}
        className="thumb-zone mt-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "กำลังส่ง…" : "ส่งความคิดเห็น"}
      </button>
    </form>
  );
}
