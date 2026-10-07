"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { PhoneAlerts } from "@/components/phone-alerts";
import { UserChip } from "@/components/user-chip";

export type ShellUser = {
  fullName: string;
  employeeCode: string;
  departmentName: string | null;
  branchName: string | null;
  avatarUrl: string | null;
};

export type ShellProps = {
  user: ShellUser;
  unreadNotifications: number;
  pendingTasks: number;
  canCompose: boolean;
  canViewReports: boolean;
  isAdmin: boolean;
  children: ReactNode;
};

type NavIcon = "home" | "check" | "folder" | "book" | "bell" | "chart" | "settings";
type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };

export function AppShell({
  user,
  unreadNotifications,
  pendingTasks,
  canCompose,
  canViewReports,
  isAdmin,
  children,
}: ShellProps) {
  const pathname = usePathname();

  const nav: NavItem[] = [
    { href: "/", label: "ฟีด", icon: "home" },
    { href: "/tasks", label: "งานของฉัน", icon: "check", badge: pendingTasks },
    { href: "/topics", label: "หัวข้อ", icon: "folder" },
    { href: "/knowledge", label: "คู่มือและเอกสาร", icon: "book" },
    { href: "/notifications", label: "แจ้งเตือน", icon: "bell", badge: unreadNotifications },
  ];
  if (canViewReports) nav.push({ href: "/reports", label: "รายงาน", icon: "chart" });
  if (isAdmin) nav.push({ href: "/settings", label: "ตั้งค่า", icon: "settings" });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh text-ink">
      <aside className="glass glass-thick glass-rim fixed inset-y-3 start-3 z-20 hidden w-60 flex-col px-3 py-4 text-ink xl:flex">
        <Link href="/" className="mb-5 flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-base font-bold text-accent-ink">
            H
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Hub</span>
            <span className="block text-xs text-muted">ศูนย์กลางการสื่อสาร</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="เมนูหลัก">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`thumb-zone flex items-center gap-3 rounded-[10px] px-3 text-sm font-medium ${
                isActive(item.href) ? "bg-accent text-accent-ink" : "text-ink hover:bg-surface-muted"
              }`}
            >
              <Icon name={item.icon} className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className="rounded-full bg-danger px-2 text-xs font-semibold text-white"
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="xl:ps-[16.75rem]">
        {pathname === "/" ? null : (
          <header className="hidden items-center justify-end px-4 pt-4 xl:flex">
            <UserChip fullName={user.fullName} detail={user.departmentName ?? user.employeeCode} />
          </header>
        )}
        <main className="px-3 pb-28 pt-4 xl:px-4 xl:pb-10 xl:pt-3">{children}</main>
      </div>

      <PhoneAlerts />

      {/* Thumb-zone navigation for the LINE in-app browser. */}
      <nav
        className="bar safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t px-1 xl:hidden"
        aria-label="เมนูล่าง"
      >
        <BottomLink href="/" label="ฟีด" icon="home" active={isActive("/")} />
        <BottomLink
          href="/tasks"
          label="งานของฉัน"
          icon="check"
          active={isActive("/tasks")}
          badge={pendingTasks}
        />
        {canCompose ? (
          <BottomLink href="/compose" label="สร้าง" icon="plus" active={isActive("/compose")} />
        ) : (
          <BottomLink href="/topics" label="หัวข้อ" icon="folder" active={isActive("/topics")} />
        )}
        <BottomLink href="/knowledge" label="คู่มือ" icon="book" active={isActive("/knowledge")} />
        <BottomLink
          href="/notifications"
          label="แจ้งเตือน"
          icon="bell"
          active={isActive("/notifications")}
          badge={unreadNotifications}
        />
        <BottomLink href="/settings/me" label="ฉัน" icon="user" active={isActive("/settings/me")} />
      </nav>
    </div>
  );
}

function BottomLink({
  href,
  label,
  icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: NavIcon | "plus" | "user" | "book";
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`thumb-zone flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center text-xs font-medium leading-tight ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      <span
        className={`relative grid h-8 w-10 place-items-center rounded-full ${
          active ? "bg-accent-soft" : ""
        }`}
      >
        <Icon name={icon} className="h-5 w-5" />
        {badge ? (
          <span className="absolute -top-1 end-0 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 w-full">{label}</span>
    </Link>
  );
}
