"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

/// The invite code is shown once, right after creating the record. Only its hash is stored.
export function NewEmployeeForm({
  branches,
  departments,
  positions,
}: {
  branches: Option[];
  departments: Option[];
  positions: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [created, setCreated] = useState<{ fullName: string; inviteCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode,
          fullName,
          branchId: branchId || null,
          departmentId: departmentId || null,
          positionId: positionId || null,
        }),
      });
      const data = (await response.json()) as {
        fullName?: string;
        inviteCode?: string;
        error?: string;
      };
      if (!response.ok || !data.inviteCode) {
        setError(data.error ?? "สร้างพนักงานไม่สำเร็จ");
        return;
      }
      setCreated({ fullName: data.fullName ?? fullName, inviteCode: data.inviteCode });
      setEmployeeCode("");
      setFullName("");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {created ? (
        <div className="rounded-xl border border-line bg-success-soft p-4">
          <p className="text-sm font-medium text-success">สร้าง {created.fullName} แล้ว</p>
          <p className="mt-1 text-sm">
            รหัสเชิญ:{" "}
            <span className="font-mono text-lg font-semibold tracking-widest">
              {created.inviteCode}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            ส่งรหัสนี้ให้พนักงาน ระบบแสดงรหัสเพียงครั้งเดียว
          </p>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="thumb-zone mt-2 inline-flex items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium"
          >
            รับทราบ
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="thumb-zone mt-2 inline-flex items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink"
      >
        {open ? "ปิดฟอร์ม" : "＋ เพิ่มพนักงาน"}
      </button>

      {open ? (
        <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">รหัสพนักงาน</span>
            <input
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              required
              className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">ชื่อ-นามสกุล</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label="สาขา" value={branchId} onChange={setBranchId} options={branches} />
            <Select
              label="แผนก"
              value={departmentId}
              onChange={setDepartmentId}
              options={departments}
            />
            <Select
              label="ตำแหน่ง"
              value={positionId}
              onChange={setPositionId}
              options={positions}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="thumb-zone inline-flex items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
          >
            {busy ? "กำลังบันทึก…" : "สร้างพนักงานและออกรหัสเชิญ"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
