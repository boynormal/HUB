import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { sessionUserStatus } from "@/server/shell";

export default async function PendingApprovalPage() {
  if (await getActor()) redirect("/");
  if ((await sessionUserStatus()) !== "INVITED") redirect("/signin");

  return (
    <main className="auth-screen flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end">
          <ThemeToggle />
        </div>
        <section className="glass glass-thick glass-rim relative p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
              H
            </span>
            <h1 className="text-xl font-semibold leading-tight">รอฝ่ายบุคคลอนุมัติ</h1>
          </div>
          <p className="mt-4 text-sm text-muted">
            ส่งคำขอเข้าใช้งานแล้ว ยังไม่เห็นประกาศจนกว่าฝ่ายบุคคลจะอนุมัติ ครั้งต่อไปกดเข้าสู่ระบบด้วย LINE ได้เลย
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </section>
      </div>
    </main>
  );
}
