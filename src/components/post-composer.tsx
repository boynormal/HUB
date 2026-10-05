"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };
type Topic = Option & { slug: string; color: string | null };

type TargetRule = { targetType: string; targetId: string | null };

export type ComposerAttachment = { id: string; fileName: string; fileSize: number; mimeType?: string };

export type ComposerDraft = {
  id: string;
  status: string;
  topicId: string;
  postType: string;
  priority: string;
  title: string;
  content: string;
  tagIds: string[];
  targets: TargetRule[];
  requiresConfirmation: boolean;
  confirmationDeadline: string;
  scheduledAt: string;
  expiresAt: string;
  allowComments: boolean;
  attachments: ComposerAttachment[];
};

type Props = {
  topics: Topic[];
  tags: Option[];
  branches: Option[];
  departments: Option[];
  positions: Option[];
  groups: Option[];
  activeEmployees: number;
  canPublish: boolean;
  draft?: ComposerDraft | null;
};

const POST_TYPES = [
  { value: "ANNOUNCEMENT", label: "ประกาศ" },
  { value: "NEWS", label: "ข่าวสาร" },
  { value: "ALERT", label: "แจ้งเตือน" },
  { value: "PROCEDURE", label: "คู่มือ" },
  { value: "TRAINING", label: "อบรม" },
  { value: "EVENT", label: "กิจกรรม" },
  { value: "INSTRUCTION", label: "คำสั่งงาน" },
  { value: "DOCUMENT", label: "เอกสาร" },
];

const PRIORITIES = [
  { value: "NORMAL", label: "ทั่วไป" },
  { value: "INFO", label: "ข้อมูล" },
  { value: "IMPORTANT", label: "สำคัญ" },
  { value: "URGENT", label: "ด่วน" },
  { value: "CRITICAL", label: "วิกฤต" },
];

const STEPS = ["หัวข้อ", "เนื้อหา", "ผู้รับ", "การรับทราบ", "ตรวจสอบ"];

export function PostComposer({
  topics,
  tags,
  branches,
  departments,
  positions,
  groups,
  activeEmployees,
  canPublish,
  draft = null,
}: Props) {
  const router = useRouter();
  const initialTargets = draft?.targets ?? [];
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(draft?.id ?? null);
  const [status, setStatus] = useState(draft?.status ?? "DRAFT");
  const [topicId, setTopicId] = useState(draft?.topicId ?? topics[0]?.id ?? "");
  const [topicQuery, setTopicQuery] = useState("");
  const [postType, setPostType] = useState(draft?.postType ?? "ANNOUNCEMENT");
  const [priority, setPriority] = useState(draft?.priority ?? "NORMAL");
  const [title, setTitle] = useState(draft?.title ?? "");
  const [content, setContent] = useState(draft?.content ?? "");
  const [tagIds, setTagIds] = useState<string[]>(draft?.tagIds ?? []);
  const [sendToAll, setSendToAll] = useState(
    draft ? initialTargets.some((target) => target.targetType === "ALL") : true,
  );
  const [branchIds, setBranchIds] = useState<string[]>(idsOf(initialTargets, "BRANCH"));
  const [departmentIds, setDepartmentIds] = useState<string[]>(idsOf(initialTargets, "DEPARTMENT"));
  const [positionIds, setPositionIds] = useState<string[]>(idsOf(initialTargets, "POSITION"));
  const [groupIds, setGroupIds] = useState<string[]>(idsOf(initialTargets, "GROUP"));
  const [keptTargets] = useState<TargetRule[]>(
    initialTargets.filter(
      (target) => !["ALL", "BRANCH", "DEPARTMENT", "POSITION", "GROUP"].includes(target.targetType),
    ),
  );
  const [savedFiles, setSavedFiles] = useState<ComposerAttachment[]>(draft?.attachments ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [requiresConfirmation, setRequiresConfirmation] = useState(draft?.requiresConfirmation ?? false);
  const [confirmationDeadline, setConfirmationDeadline] = useState(draft?.confirmationDeadline ?? "");
  const [scheduledAt, setScheduledAt] = useState(draft?.scheduledAt ?? "");
  const [expiresAt, setExpiresAt] = useState(draft?.expiresAt ?? "");
  const [allowComments, setAllowComments] = useState(draft?.allowComments ?? true);
  const [recipientPreview, setRecipientPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets: TargetRule[] = useMemo(() => {
    if (sendToAll) return [{ targetType: "ALL", targetId: null }, ...keptTargets];
    return [
      ...branchIds.map((id) => ({ targetType: "BRANCH", targetId: id })),
      ...departmentIds.map((id) => ({ targetType: "DEPARTMENT", targetId: id })),
      ...positionIds.map((id) => ({ targetType: "POSITION", targetId: id })),
      ...groupIds.map((id) => ({ targetType: "GROUP", targetId: id })),
      ...keptTargets,
    ];
  }, [sendToAll, branchIds, departmentIds, positionIds, groupIds, keptTargets]);

  const topicName = topics.find((topic) => topic.id === topicId)?.name ?? "";

  function toggle(list: string[], setList: (next: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  async function previewRecipients() {
    setRecipientPreview(null);
    const response = await fetch("/api/targets/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { count: number };
    setRecipientPreview(data.count);
  }

  function validateStep(index: number): string | null {
    if (index === 0 && !topicId) return "เลือกหัวข้อก่อน";
    if (index === 1) {
      if (title.trim().length < 3) return "หัวเรื่องสั้นเกินไป";
      if (content.trim().length === 0) return "ใส่เนื้อหาก่อน";
    }
    if (index === 2 && targets.length === 0) return "เลือกผู้รับอย่างน้อยหนึ่งกลุ่ม";
    if (index === 3 && requiresConfirmation && !confirmationDeadline) {
      return "ประกาศที่ต้องรับทราบต้องมีกำหนดเวลา";
    }
    return null;
  }

  function next() {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step === 2) void previewRecipients();
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

  async function save(action: "draft" | "publish") {
    for (let index = 0; index < 4; index += 1) {
      const problem = validateStep(index);
      if (problem) {
        setError(problem);
        setStep(index);
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(savedId ? `/api/posts/${savedId}` : "/api/posts", {
        method: savedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          postType,
          title,
          summary: null,
          content: contentToHtml(content),
          priority,
          requiresRead: true,
          requiresConfirmation,
          confirmationDeadline: confirmationDeadline || null,
          scheduledAt: scheduledAt || null,
          expiresAt: expiresAt || null,
          allowComments,
          tagIds,
          targets,
        }),
      });
      const saved = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) {
        setError(saved.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      const postId = savedId ?? saved.id;
      if (!postId) {
        setError("บันทึกไม่สำเร็จ");
        return;
      }
      setSavedId(postId);

      const uploaded = await uploadPending(postId);
      if (!uploaded) return;

      if (action === "publish" && status !== "PUBLISHED") {
        const publish = await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
        if (!publish.ok) {
          const data = (await publish.json()) as { error?: string };
          setError(data.error ?? "เผยแพร่ไม่สำเร็จ ประกาศถูกบันทึกเป็นฉบับร่างแล้ว");
          setStatus("DRAFT");
          return;
        }
      }
      router.push(`/posts/${postId}`);
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  function queueFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const file of list) {
      const problem = fileProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
      next.push(file);
    }
    setError(null);
    setPendingFiles((current) => [...current, ...next]);
  }

  async function uploadPending(postId: string): Promise<boolean> {
    for (const file of pendingFiles) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/posts/${postId}/attachments`, { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? `อัปโหลด ${file.name} ไม่สำเร็จ`);
        return false;
      }
    }
    setPendingFiles([]);
    return true;
  }

  async function removeSavedFile(id: string) {
    const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "ลบไฟล์ไม่สำเร็จ");
      return;
    }
    setSavedFiles((current) => current.filter((file) => file.id !== id));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">{savedId ? "แก้ไขประกาศ" : "สร้างประกาศ"}</h1>

      <ol className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="ขั้นตอน">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              aria-current={step === index ? "step" : undefined}
              className={`thumb-zone inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                step === index
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-surface text-muted"
              }`}
            >
              <span aria-hidden="true">{index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 shadow-card">
        {step === 0 ? (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium">หัวข้อ</legend>
              <label className="sr-only" htmlFor="composer-topic-search">
                ค้นหาหัวข้อ
              </label>
              <input
                id="composer-topic-search"
                value={topicQuery}
                onChange={(event) => setTopicQuery(event.target.value)}
                placeholder="ค้นหาชื่อหัวข้อ"
                className="thumb-zone mt-2 w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {topics
                  .filter((topic) => {
                    const needle = topicQuery.trim().toLocaleLowerCase();
                    return topic.id === topicId || !needle || topic.name.toLocaleLowerCase().includes(needle);
                  })
                  .map((topic) => (
                  <label
                    key={topic.id}
                    className={`thumb-zone flex cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
                      topicId === topic.id ? "border-accent bg-accent-soft" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="topic"
                      value={topic.id}
                      checked={topicId === topic.id}
                      onChange={() => setTopicId(topic.id)}
                      className="accent-[var(--hub-accent)]"
                    />
                    {topic.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm">
              <span className="mb-1 block text-muted">ชนิดประกาศ</span>
              <select
                value={postType}
                onChange={(event) => setPostType(event.target.value)}
                className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              >
                {POST_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted">ระดับความสำคัญ</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">หัวเรื่อง</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">เนื้อหา</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={12}
                className="w-full rounded-lg border border-line bg-surface p-3 text-[15px]"
                placeholder={"พิมพ์เนื้อหา เว้นบรรทัดเพื่อขึ้นย่อหน้าใหม่\nขึ้นต้นบรรทัดด้วย - เพื่อทำรายการ"}
              />
            </label>
            <fieldset>
              <legend className="text-sm font-medium">แท็ก</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                      tagIds.includes(tag.id) ? "border-accent bg-accent-soft" : "border-line"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={tagIds.includes(tag.id)}
                      onChange={() => toggle(tagIds, setTagIds, tag.id)}
                    />
                    #{tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <FilePicker
              saved={savedFiles}
              pending={pendingFiles}
              onPick={queueFiles}
              onRemovePending={(index) =>
                setPendingFiles((current) => current.filter((_, item) => item !== index))
              }
              onRemoveSaved={(id) => void removeSavedFile(id)}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <label className="thumb-zone flex items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <input
                type="checkbox"
                checked={sendToAll}
                onChange={(event) => setSendToAll(event.target.checked)}
                className="accent-[var(--hub-accent)]"
              />
              ส่งถึงพนักงานทุกคน ({activeEmployees} คน)
            </label>

            {!sendToAll ? (
              <div className="space-y-4">
                <TargetGroup
                  title="สาขา"
                  options={branches}
                  selected={branchIds}
                  onToggle={(id) => toggle(branchIds, setBranchIds, id)}
                />
                <TargetGroup
                  title="แผนก"
                  options={departments}
                  selected={departmentIds}
                  onToggle={(id) => toggle(departmentIds, setDepartmentIds, id)}
                />
                <TargetGroup
                  title="ตำแหน่ง"
                  options={positions}
                  selected={positionIds}
                  onToggle={(id) => toggle(positionIds, setPositionIds, id)}
                />
                {groups.length > 0 ? (
                  <TargetGroup
                    title="กลุ่ม"
                    options={groups}
                    selected={groupIds}
                    onToggle={(id) => toggle(groupIds, setGroupIds, id)}
                  />
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={previewRecipients}
              className="thumb-zone inline-flex items-center rounded-lg border border-line px-3 text-sm font-medium"
            >
              นับจำนวนผู้รับ
            </button>
            {recipientPreview !== null ? (
              <p className="text-sm font-medium">ส่งถึง {recipientPreview} คน</p>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <label className="thumb-zone flex items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <input
                type="checkbox"
                checked={requiresConfirmation}
                onChange={(event) => setRequiresConfirmation(event.target.checked)}
                className="accent-[var(--hub-accent)]"
              />
              ต้องกดรับทราบ
            </label>

            {requiresConfirmation ? (
              <label className="block text-sm">
                <span className="mb-1 block text-muted">กำหนดรับทราบภายใน</span>
                <input
                  type="datetime-local"
                  value={confirmationDeadline}
                  onChange={(event) => setConfirmationDeadline(event.target.value)}
                  className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
                />
                <span className="mt-1 block text-xs text-muted">
                  ระบบจะเตือนล่วงหน้า 24 ชั่วโมง และ 2 ชั่วโมง แล้วสรุปให้ผู้จัดการแผนกเมื่อครบกำหนด
                </span>
              </label>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1 block text-muted">ตั้งเวลาเผยแพร่ (ไม่บังคับ)</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-muted">หมดอายุ (ไม่บังคับ)</span>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
              />
            </label>

            <label className="thumb-zone flex items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <input
                type="checkbox"
                checked={allowComments}
                onChange={(event) => setAllowComments(event.target.checked)}
                className="accent-[var(--hub-accent)]"
              />
              เปิดให้แสดงความคิดเห็น
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <dl className="space-y-2 text-sm">
            <Row label="หัวข้อ" value={topicName} />
            <Row label="หัวเรื่อง" value={title} />
            <Row
              label="ผู้รับ"
              value={
                sendToAll
                  ? `ทุกคน (${activeEmployees} คน)`
                  : `${targets.length} กลุ่ม${recipientPreview !== null ? ` · ${recipientPreview} คน` : ""}`
              }
            />
            <Row
              label="ต้องรับทราบ"
              value={
                requiresConfirmation
                  ? `ใช่ ภายใน ${confirmationDeadline.replace("T", " ")}`
                  : "ไม่ต้อง"
              }
            />
            <Row
              label="เวลาเผยแพร่"
              value={
                status === "PUBLISHED"
                  ? "เผยแพร่แล้ว"
                  : scheduledAt
                    ? scheduledAt.replace("T", " ")
                    : "เผยแพร่ทันที"
              }
            />
            <Row label="ไฟล์แนบ" value={`${savedFiles.length + pendingFiles.length} ไฟล์`} />
          </dl>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="thumb-zone inline-flex items-center rounded-lg border border-line px-4 text-sm font-medium"
            >
              ย้อนกลับ
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="thumb-zone inline-flex items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink"
            >
              ถัดไป
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => save("draft")}
                className="thumb-zone inline-flex items-center rounded-lg border border-line px-4 text-sm font-medium disabled:opacity-60"
              >
                {busy ? "กำลังบันทึก…" : status === "PUBLISHED" ? "บันทึกการแก้ไข" : "บันทึกฉบับร่าง"}
              </button>
              {canPublish && status !== "PUBLISHED" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save("publish")}
                  className="thumb-zone inline-flex items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-60"
                >
                  {busy ? "กำลังเผยแพร่…" : scheduledAt ? "บันทึกและตั้งเวลา" : "เผยแพร่"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{title}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={`thumb-zone flex cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${
              selected.includes(option.id) ? "border-accent bg-accent-soft" : "border-line"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => onToggle(option.id)}
              className="accent-[var(--hub-accent)]"
            />
            {option.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-line pb-2">
      <dt className="w-28 shrink-0 text-muted">{label}</dt>
      <dd className="flex-1 font-medium">{value || "—"}</dd>
    </div>
  );
}

/// The composer takes plain text. Paragraphs and dash lists become HTML, and the server
/// sanitises the result again before storing it.
function contentToHtml(text: string): string {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^\s*[-•]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${escapeHtml(line.replace(/^\s*[-•]\s+/, ""))}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${lines.map((line) => escapeHtml(line)).join("<br />")}</p>`;
    })
    .join("");
}

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".zip",
]);

function fileProblem(file: File): string | null {
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) return `ไม่รองรับไฟล์ ${file.name}`;
  if (!file.type) return `${file.name} ไม่ระบุชนิดไฟล์`;
  if (file.size <= 0) return `${file.name} ว่าง`;
  if (file.size > 25 * 1024 * 1024) return `${file.name} ใหญ่เกิน 25 MB`;
  return null;
}

function idsOf(targets: TargetRule[], type: string): string[] {
  return targets
    .filter((target) => target.targetType === type && target.targetId)
    .map((target) => target.targetId as string);
}

function FilePicker({
  saved,
  pending,
  onPick,
  onRemovePending,
  onRemoveSaved,
}: {
  saved: ComposerAttachment[];
  pending: File[];
  onPick: (list: FileList | null) => void;
  onRemovePending: (index: number) => void;
  onRemoveSaved: (id: string) => void;
}) {
  const [over, setOver] = useState(false);
  const accept = [...ALLOWED_EXTENSIONS].join(",");

  return (
    <fieldset>
      <legend className="text-sm font-medium">ไฟล์แนบ</legend>
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          onPick(event.dataTransfer.files);
        }}
        className={`mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center ${
          over ? "border-accent bg-accent-soft" : "border-line bg-surface"
        }`}
      >
        <input
          type="file"
          multiple
          accept={accept}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = "";
          }}
          className="sr-only"
        />
        <span className="text-sm font-semibold">{over ? "วางไฟล์ได้เลย" : "โยนไฟล์มาวางที่นี่"}</span>
        <span className="mt-1 text-sm text-muted">หรือกดเพื่อเลือกจากเครื่อง</span>
        <span className="mt-3 text-xs text-muted">pdf, word, excel, รูป, mp4 หรือ zip ไม่เกิน 25 MB ต่อไฟล์</span>
      </label>
      {saved.length + pending.length === 0 ? (
        <p className="mt-3 text-sm text-muted">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <>
          {saved.some(isVisual) || pending.some((file) => isVisualType(file.type)) ? (
            <ul className="scroll-plain mt-3 flex w-full min-w-0 max-w-full flex-nowrap gap-2 overflow-x-auto overscroll-x-contain">
              {saved.filter(isVisual).map((file) => (
                <li key={file.id} className="relative h-36 w-36 shrink-0">
                  <AttachmentPreview
                    name={file.fileName}
                    mimeType={file.mimeType}
                    src={`/api/attachments/${file.id}?inline=1`}
                  />
                  <button
                    type="button"
                    className="absolute end-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white"
                    onClick={() => onRemoveSaved(file.id)}
                  >
                    ลบ
                  </button>
                </li>
              ))}
              {pending.map((file, index) =>
                isVisualType(file.type) ? (
                  <li key={`${file.name}-${index}`} className="relative h-36 w-36 shrink-0">
                    <PendingPreview file={file} />
                    <button
                      type="button"
                      className="absolute end-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white"
                      onClick={() => onRemovePending(index)}
                    >
                      ลบ
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
          {saved.some((file) => !isVisual(file)) || pending.some((file) => !isVisualType(file.type)) ? (
          <ul className="mt-3 space-y-2">
            {saved.filter((file) => !isVisual(file)).map((file) => (
              <li key={file.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3">
                <span className="min-w-0 flex-1 py-2">
                  <span className="block truncate text-sm font-medium">{file.fileName}</span>
                  <span className="block text-xs text-muted">{formatBytes(file.fileSize)}</span>
                </span>
                <button
                  type="button"
                  className="thumb-zone shrink-0 rounded-full px-3 text-sm font-medium text-danger"
                  onClick={() => onRemoveSaved(file.id)}
                >
                  ลบ
                </button>
              </li>
            ))}
            {pending.map((file, index) =>
              isVisualType(file.type) ? null : (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3"
                >
                  <span className="min-w-0 flex-1 py-2">
                    <span className="block truncate text-sm font-medium">{file.name}</span>
                    <span className="block text-xs text-muted">{formatBytes(file.size)} · รออัปโหลด</span>
                  </span>
                  <button
                    type="button"
                    className="thumb-zone shrink-0 rounded-full px-3 text-sm font-medium text-danger"
                    onClick={() => onRemovePending(index)}
                  >
                    เอาออก
                  </button>
                </li>
              ),
            )}
          </ul>
          ) : null}
        </>
      )}
    </fieldset>
  );
}

function AttachmentPreview({
  name,
  mimeType,
  src,
}: {
  name: string;
  mimeType?: string;
  src: string | null;
}) {
  if (!src) return null;
  if (mimeType?.startsWith("video/")) {
    return (
      <video
        src={src}
        muted
        playsInline
        preload="metadata"
        className="h-full w-full rounded-xl border border-line bg-black object-contain"
      />
    );
  }
  return (
    <img src={src} alt={name} className="h-full w-full rounded-xl border border-line bg-surface-muted object-contain" />
  );
}

function isVisual(file: ComposerAttachment) {
  return isVisualType(file.mimeType ?? "");
}

function isVisualType(mimeType: string) {
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

function PendingPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const visual = file.type.startsWith("image/") || file.type.startsWith("video/");

  useEffect(() => {
    if (!visual) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, visual]);

  if (!url) return null;
  return <AttachmentPreview name={file.name} mimeType={file.type} src={url} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
