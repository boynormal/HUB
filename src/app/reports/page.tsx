import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { loadAcknowledgementSummary } from "@/server/feed";
import { PERMISSIONS, hasPermission, isCommunicationAdmin } from "@/server/rbac";
import {
  branchReport,
  departmentReport,
  employeeReport,
  postReport,
  topicReport,
} from "@/server/reports";
import { requirePageActor, shellData } from "@/server/shell";
import { formatThaiDateTime } from "@/server/time";

const TABS = [
  { key: "posts", label: "ตามประกาศ" },
  { key: "branches", label: "ตามสาขา" },
  { key: "departments", label: "ตามแผนก" },
  { key: "employees", label: "ตามพนักงาน" },
  { key: "topics", label: "ตามหัวข้อ" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const actor = await requirePageActor();
  if (!hasPermission(actor, PERMISSIONS.viewReports) && !isCommunicationAdmin(actor)) {
    redirect("/");
  }
  const { view = "posts" } = await searchParams;
  const [shell, summary] = await Promise.all([shellData(actor), loadAcknowledgementSummary(30)]);

  return (
    <AppShell {...shell}>
      <h1 className="text-xl font-semibold">รายงานการรับทราบ</h1>
      <p className="mt-1 text-sm text-muted">
        30 วันล่าสุด: รับทราบ {summary.acknowledged} จาก {summary.total} รายการ ({summary.percent}%)
      </p>

      <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="มุมมองรายงาน">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/reports?view=${tab.key}`}
            aria-current={view === tab.key ? "page" : undefined}
            className={`thumb-zone inline-flex shrink-0 items-center rounded-lg border px-4 text-sm font-medium ${
              view === tab.key
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="data-table mt-4">
        {view === "posts" ? <PostTable /> : null}
        {view === "branches" ? <GroupTable kind="branch" /> : null}
        {view === "departments" ? <GroupTable kind="department" /> : null}
        {view === "employees" ? <EmployeeTable /> : null}
        {view === "topics" ? <TopicTable /> : null}
      </div>
    </AppShell>
  );
}

async function PostTable() {
  const rows = await postReport(50);
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">สถานะการรับทราบของแต่ละประกาศ</caption>
      <thead className="bg-surface-muted">
        <tr>
          <th className="px-3 py-2 text-start font-medium">ประกาศ</th>
          <th className="px-3 py-2 text-start font-medium">เผยแพร่</th>
          <th className="px-3 py-2 text-start font-medium">อ่าน</th>
          <th className="px-3 py-2 text-start font-medium">รับทราบ</th>
          <th className="px-3 py-2 text-start font-medium">เกินกำหนด</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.postId} className="border-t border-line">
            <td className="px-3 py-2">
              <Link href={`/posts/${row.postId}`} className="font-medium hover:underline">
                {row.title}
              </Link>
              <span className="block text-xs text-muted">{row.topicName}</span>
            </td>
            <td className="px-3 py-2 text-muted">{formatThaiDateTime(row.publishedAt)}</td>
            <td className="px-3 py-2">
              {row.read}/{row.recipients}
            </td>
            <td className="px-3 py-2">
              {row.requiresConfirmation ? `${row.acknowledged}/${row.recipients}` : "—"}
            </td>
            <td className={`px-3 py-2 ${row.overdue > 0 ? "text-danger" : "text-muted"}`}>
              {row.overdue > 0 ? row.overdue : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function GroupTable({ kind }: { kind: "branch" | "department" }) {
  const rows = kind === "branch" ? await branchReport() : await departmentReport();
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">
        อัตราการรับทราบราย{kind === "branch" ? "สาขา" : "แผนก"}
      </caption>
      <thead className="bg-surface-muted">
        <tr>
          <th className="px-3 py-2 text-start font-medium">
            {kind === "branch" ? "สาขา" : "แผนก"}
          </th>
          <th className="px-3 py-2 text-start font-medium">ต้องรับทราบ</th>
          <th className="px-3 py-2 text-start font-medium">รับทราบแล้ว</th>
          <th className="px-3 py-2 text-start font-medium">อัตรา</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-t border-line">
            <td className="px-3 py-2 font-medium">{row.name}</td>
            <td className="px-3 py-2 text-muted">{row.recipients}</td>
            <td className="px-3 py-2">{row.acknowledged}</td>
            <td className="px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="w-10 tabular-nums">{row.percent}%</span>
                <span
                  aria-hidden="true"
                  className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted"
                >
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function EmployeeTable() {
  const rows = await employeeReport({ limit: 100 });
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">สถานะการอ่านและรับทราบของพนักงานแต่ละคน</caption>
      <thead className="bg-surface-muted">
        <tr>
          <th className="px-3 py-2 text-start font-medium">พนักงาน</th>
          <th className="px-3 py-2 text-start font-medium">แผนก</th>
          <th className="px-3 py-2 text-start font-medium">ได้รับ</th>
          <th className="px-3 py-2 text-start font-medium">รับทราบ</th>
          <th className="px-3 py-2 text-start font-medium">ค้าง</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.userId} className="border-t border-line">
            <td className="px-3 py-2">
              <span className="block font-medium">{row.fullName}</span>
              <span className="block text-xs text-muted">{row.employeeCode}</span>
            </td>
            <td className="px-3 py-2 text-muted">{row.departmentName ?? "—"}</td>
            <td className="px-3 py-2">{row.total}</td>
            <td className="px-3 py-2">{row.acknowledged}</td>
            <td className={`px-3 py-2 ${row.overdue > 0 ? "text-danger" : ""}`}>
              {row.pending}
              {row.overdue > 0 ? ` (เกินกำหนด ${row.overdue})` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function TopicTable() {
  const rows = await topicReport();
  if (rows.length === 0) return <Empty />;
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">กิจกรรมรายหัวข้อ</caption>
      <thead className="bg-surface-muted">
        <tr>
          <th className="px-3 py-2 text-start font-medium">หัวข้อ</th>
          <th className="px-3 py-2 text-start font-medium">ประกาศ</th>
          <th className="px-3 py-2 text-start font-medium">ส่งถึง</th>
          <th className="px-3 py-2 text-start font-medium">รับทราบ</th>
          <th className="px-3 py-2 text-start font-medium">ความคิดเห็น</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.topicId} className="border-t border-line">
            <td className="px-3 py-2 font-medium">{row.name}</td>
            <td className="px-3 py-2">{row.posts}</td>
            <td className="px-3 py-2 text-muted">{row.recipients}</td>
            <td className="px-3 py-2">{row.acknowledged}</td>
            <td className="px-3 py-2 text-muted">{row.comments}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty() {
  return <p className="p-6 text-center text-sm text-muted">ยังไม่มีข้อมูลสำหรับรายงานนี้</p>;
}
