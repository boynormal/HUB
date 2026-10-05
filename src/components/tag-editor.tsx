"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tag = {
  id: string;
  name: string;
  isActive: boolean;
  posts: number;
};

function slugFromName(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin.length >= 2) return latin.slice(0, 50);
  return `item-${Math.random().toString(36).slice(2, 8)}`;
}

export function TagEditor({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "on" | "off">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needle = query.trim().toLocaleLowerCase();
  const visible = tags.filter((tag) => {
    if (status === "on" && !tag.isActive) return false;
    if (status === "off" && tag.isActive) return false;
    if (!needle) return true;
    return tag.name.toLocaleLowerCase().includes(needle);
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
          void save("/api/tags", "POST", { name, slug: slugFromName(name) });
        }}
      >
        <p className="text-sm font-semibold">เพิ่มแท็ก</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="new-tag">
            ชื่อแท็กใหม่
          </label>
          <input
            id="new-tag"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="ชื่อแท็กใหม่"
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
        <label className="sr-only" htmlFor="tag-search">
          ค้นหาแท็ก
        </label>
        <input
          id="tag-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ค้นหาชื่อแท็ก"
          className="thumb-zone min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[15px]"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="สถานะแท็ก">
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

      {tags.length === 0 ? (
        <p className="hub-card mt-3 p-4 text-sm text-muted">ยังไม่มีแท็ก</p>
      ) : visible.length === 0 ? (
        <p className="hub-card mt-3 p-4 text-sm text-muted">ไม่พบแท็กที่ค้นหา</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((tag) => {
            const open = openId === tag.id;
            return (
              <li key={tag.id} className="hub-card p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">#{tag.name}</p>
                    <p className="text-xs text-muted">
                      {tag.isActive ? "ใช้งาน" : "ปิดใช้"} · {tag.posts} ประกาศ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : tag.id)}
                    className="thumb-zone shrink-0 rounded-full border border-line px-4 text-sm font-medium"
                  >
                    {open ? "ปิด" : "แก้ไข"}
                  </button>
                </div>
                {open ? (
                  <TagForm tag={tag} busy={busy} onSave={(body) => save(`/api/tags/${tag.id}`, "PATCH", body)} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TagForm({
  tag,
  busy,
  onSave,
}: {
  tag: Tag;
  busy: boolean;
  onSave: (body: { name: string; isActive: boolean }) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [isActive, setIsActive] = useState(tag.isActive);

  return (
    <form
      className="mt-4 grid gap-4 rounded-2xl bg-surface/80 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ name, isActive });
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
        <legend className="mb-2 text-sm text-muted">สถานะ</legend>
        <div className="flex flex-wrap gap-2">
          {[
            { value: true, label: "ใช้งาน" },
            { value: false, label: "ปิดใช้" },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={isActive === option.value}
              onClick={() => setIsActive(option.value)}
              className={`thumb-zone rounded-full px-4 text-sm ${
                isActive === option.value ? "bg-accent font-semibold text-accent-ink" : "border border-line bg-surface"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
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
