"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };
type Employee = {
  id: string;
  employeeCode: string;
  fullName: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED";
  lineLinked: boolean;
  branchId: string | null;
  departmentId: string | null;
  positionId: string | null;
};

const STATUS_LABEL = {
  INVITED: "รอผูก LINE",
  ACTIVE: "ใช้งาน",
  SUSPENDED: "ระงับ",
} as const;

export function EmployeeEditor({
  employees,
  branches,
  departments,
  positions,
}: {
  employees: Employee[];
  branches: Option[];
  departments: Option[];
  positions: Option[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ id: string; code: string } | null>(null);

  async function save(employee: Employee, next: Omit<Employee, "id" | "employeeCode" | "lineLinked">) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setOpenId(null);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function reissue(employee: Employee) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${employee.id}/invite`, { method: "POST" });
      const data = (await response.json()) as { error?: string; inviteCode?: string };
      if (!response.ok || !data.inviteCode) {
        setError(data.error ?? "ออกรหัสเชิญไม่สำเร็จ");
        return;
      }
      setIssued({ id: employee.id, code: data.inviteCode });
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
      <ul className="space-y-2">
        {employees.map((employee) => (
          <li key={employee.id} className="hub-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{employee.fullName}</p>
                <p className="text-xs text-muted">
                  {employee.employeeCode} · {STATUS_LABEL[employee.status]} ·{" "}
                  {employee.lineLinked ? "ผูก LINE แล้ว" : "ยังไม่ผูก LINE"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => reissue(employee)}
                className="thumb-zone rounded-full border border-line px-4 text-sm font-medium disabled:opacity-60"
              >
                ออกรหัสเชิญใหม่
              </button>
              <button
                type="button"
                onClick={() => setOpenId(openId === employee.id ? null : employee.id)}
                className="thumb-zone rounded-full border border-line px-4 text-sm font-medium"
              >
                {openId === employee.id ? "ปิด" : "แก้ไข"}
              </button>
            </div>
            {issued?.id === employee.id ? (
              <p className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">
                รหัสเชิญใหม่ของ {employee.fullName}:{" "}
                <span className="font-semibold tracking-wide">{issued.code}</span>
                <span className="mt-1 block text-xs text-muted">แสดงครั้งเดียว จดไว้ก่อนปิดหน้านี้</span>
              </p>
            ) : null}
            {openId === employee.id ? (
              <EditForm
                employee={employee}
                branches={branches}
                departments={departments}
                positions={positions}
                busy={busy}
                onSave={(next) => save(employee, next)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditForm({
  employee,
  branches,
  departments,
  positions,
  busy,
  onSave,
}: {
  employee: Employee;
  branches: Option[];
  departments: Option[];
  positions: Option[];
  busy: boolean;
  onSave: (next: Omit<Employee, "id" | "employeeCode" | "lineLinked">) => void;
}) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [branchId, setBranchId] = useState(employee.branchId ?? "");
  const [departmentId, setDepartmentId] = useState(employee.departmentId ?? "");
  const [positionId, setPositionId] = useState(employee.positionId ?? "");
  const [status, setStatus] = useState(employee.status);

  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          fullName,
          branchId: branchId || null,
          departmentId: departmentId || null,
          positionId: positionId || null,
          status,
        });
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted">ชื่อ-นามสกุล</span>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">สถานะ</span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as Employee["status"])}
          className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px]"
        >
          <option value="INVITED">รอผูก LINE</option>
          <option value="ACTIVE">ใช้งาน</option>
          <option value="SUSPENDED">ระงับ</option>
        </select>
      </label>
      <Select label="สาขา" value={branchId} options={branches} onChange={setBranchId} />
      <Select label="แผนก" value={departmentId} options={departments} onChange={setDepartmentId} />
      <Select label="ตำแหน่ง" value={positionId} options={positions} onChange={setPositionId} />
      <div className="flex items-end">
        <button
          type="submit"
          disabled={busy}
          className="thumb-zone rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </form>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
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
