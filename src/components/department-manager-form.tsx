"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string; managerUserId: string | null };
type Person = { id: string; fullName: string; employeeCode: string };

/// One select per department. Saving replaces the single manager, it does not add a second one.
export function DepartmentManagerForm({
  departments,
  people,
}: {
  departments: Department[];
  people: Person[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(departments.map((department) => [department.id, department.managerUserId ?? ""])),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(departmentId: string) {
    setBusyId(departmentId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/departments/${departmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerUserId: choice[departmentId] || null }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setMessage("บันทึกผู้จัดการแล้ว");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองอีกครั้ง");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {error ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success">
          {message}
        </p>
      ) : null}
      <ul className="space-y-2">
        {departments.map((department) => (
          <li key={department.id} className="hub-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 font-medium">{department.name}</span>
            <label className="sr-only" htmlFor={`manager-${department.id}`}>
              ผู้จัดการ{department.name}
            </label>
            <select
              id={`manager-${department.id}`}
              value={choice[department.id] ?? ""}
              onChange={(event) =>
                setChoice((current) => ({ ...current, [department.id]: event.target.value }))
              }
              className="thumb-zone w-full rounded-lg border border-line bg-surface px-3 text-[15px] sm:w-72"
            >
              <option value="">ยังไม่กำหนด</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName} ({person.employeeCode})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busyId === department.id}
              onClick={() => save(department.id)}
              className="thumb-zone inline-flex items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-60"
            >
              {busyId === department.id ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
