import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { AdminSignInForm } from "@/components/admin-sign-in-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AdminSignInPage() {
  if (await getActor()) redirect("/");

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
            <div>
              <h1 className="text-xl font-semibold leading-tight">เข้าสู่ระบบผู้ดูแล</h1>
              <p className="text-sm text-muted">สำหรับตั้งค่าระบบก่อนเปิดใช้ LINE</p>
            </div>
          </div>
          <AdminSignInForm />
        </section>
        <p className="mt-4 text-center text-sm">
          <Link href="/signin" className="text-accent underline">
            กลับไปเข้าสู่ระบบด้วย LINE
          </Link>
        </p>
      </div>
    </main>
  );
}
