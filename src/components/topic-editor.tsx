"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Topic = {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
  maxPinned: number;
  posts: number;
};

const COLORS = [
  { value: "#1E3A5F", label: "กรมท่า" },
  { value: "#1D4E89", label: "น้ำเงิน" },
  { value: "#1A6FB5", label: "ฟ้า" },
  { value: "#0E7490", label: "คราม" },
  { value: "#0F6E56", label: "เขียว" },
  { value: "#3D7A1A", label: "เขียวอ่อน" },
  { value: "#B45309", label: "เหลือง" },
  { value: "#C2410C", label: "ส้ม" },
  { value: "#B42318", label: "แดง" },
  { value: "#BE185D", label: "ชมพู" },
  { value: "#6D28D9", label: "ม่วง" },
  { value: "#7A4E2D", label: "น้ำตาล" },
  { value: "#5C6570", label: "เทา" },
];

const PIN_OPTIONS = [0, 1, 3, 5];

function slugFromName(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin.length >= 2) return latin.slice(0, 50);
  return `item-${Math.random().toString(36).slice(2, 8)}`;
}

export function TopicEditor({ topics }: { topics: Topic[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "on" | "off">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const visible = topics.filter((topic) => {
    if (status === "on" && !topic.isActive) return false;
    if (status === "off" && topic.isActive) return false;
    if (!needle) return true;
    return topic.name.toLocaleLowerCase().includes(needle);
  });

  async function save(url: string, method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setName("");
      setOpenId(null);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <form
        className="hub-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save("/api/topics", "POST", {
            name,
            slug: slugFromName(name),
            maxPinned: 3,
            sortOrder: topics.length,
          });
        }}
      >
        <p className="text-sm font-semibold">เพิ่มหัวข้อ</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="new-topic">
            ชื่อหัวข้อใหม่
          </label>
          <input
            id="new-topic"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="ชื่อหัวข้อใหม่"
            className="thumb-zone min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px]"
          />
          <button
            type="submit"
            disabled={busy}
            className="thumb-zone rounded-full bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            เพิ่ม
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="topic-search">
          ค้นหาหัวข้อ
        </label>
        <input
          id="topic-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาชื่อหัวข้อ"
          className="thumb-zone min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px]"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="สถานะหัวข้อ">
          {(
            [
              ["all", "ทั้งหมด"],
              ["on", "ใช้งาน"],
              ["off", "ปิดใช้"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`thumb-zone rounded-full px-4 text-sm ${
                status === value ? "bg-accent font-semibold text-accent-ink" : "border border-line bg-surface"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {topics.length === 0 ? (
        <p className="hub-card mt-3 p-4 text-sm text-muted">ยังไม่มีหัวข้อ</p>
      ) : visible.length === 0 ? (
        <p className="hub-card mt-3 p-4 text-sm text-muted">ไม่พบหัวข้อที่ค้นหา</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((topic) => {
            const open = openId === topic.id;
            const color = topic.color ?? "#5C6570";
            return (
              <li key={topic.id} className="hub-card p-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{topic.name}</p>
                    <p className="text-xs text-muted">
                      {topic.isActive ? "ใช้งาน" : "ปิดใช้"} · {topic.posts} ประกาศ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : topic.id)}
                    className="thumb-zone shrink-0 rounded-full border border-line px-4 text-sm font-medium"
                  >
                    {open ? "ปิด" : "แก้ไข"}
                  </button>
                </div>
                {open ? (
                  <TopicForm
                    topic={topic}
                    busy={busy}
                    onSave={(body) => save(`/api/topics/${topic.id}`, "PATCH", body)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TopicForm({
  topic,
  busy,
  onSave,
}: {
  topic: Topic;
  busy: boolean;
  onSave: (body: { name: string; color: string; isActive: boolean; maxPinned: number }) => void;
}) {
  const [name, setName] = useState(topic.name);
  const [color, setColor] = useState(topic.color ?? COLORS[0].value);
  const [isActive, setIsActive] = useState(topic.isActive);
  const [maxPinned, setMaxPinned] = useState(topic.maxPinned);
  const pins = PIN_OPTIONS.includes(maxPinned) ? PIN_OPTIONS : [maxPinned, ...PIN_OPTIONS];
  const colors = COLORS.some((item) => item.value.toLowerCase() === color.toLowerCase())
    ? COLORS
    : [{ value: color, label: "สีเดิม" }, ...COLORS];

  const selected = colors.find((item) => item.value.toLowerCase() === color.toLowerCase());

  return (
    <form
      className="mt-4 grid gap-4 rounded-2xl bg-surface/80 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, color, isActive, maxPinned });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted">ชื่อ</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="thumb-zone w-full rounded-xl border border-line bg-surface px-3 text-[15px]"
        />
      </label>

      <fieldset>
        <legend className="mb-2 text-sm text-muted">
          สี <span className="font-medium text-ink">{selected?.label ?? "สีเดิม"}</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {colors.map((item) => {
            const pressed = color.toLowerCase() === item.value.toLowerCase();
            return (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                aria-pressed={pressed}
                onClick={() => setColor(item.value)}
                className="thumb-zone w-11 rounded-full"
                style={{
                  backgroundColor: item.value,
                  boxShadow: pressed ? "0 0 0 2px var(--panel-solid), 0 0 0 4px var(--accent)" : undefined,
                }}
              />
            );
          })}
        </div>
      </fieldset>

      <ChoiceRow
        label="ปักหมุดได้"
        value={String(maxPinned)}
        options={pins.map((value) => ({ value: String(value), label: String(value) }))}
        onChange={(value) => setMaxPinned(Number(value))}
      />
      <ChoiceRow
        label="สถานะ"
        value={isActive ? "on" : "off"}
        options={[
          { value: "on", label: "ใช้งาน" },
          { value: "off", label: "ปิดใช้" },
        ]}
        onChange={(value) => setIsActive(value === "on")}
      />

      <button
        type="submit"
        disabled={busy}
        className="thumb-zone w-full rounded-full bg-accent text-sm font-semibold text-accent-ink disabled:opacity-60"
      >
        {busy ? "กำลังบันทึก…" : "บันทึก"}
      </button>
    </form>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const pressed = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(option.value)}
              className={`thumb-zone rounded-full px-4 text-sm ${
                pressed ? "bg-accent font-semibold text-accent-ink" : "border border-line bg-surface"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
