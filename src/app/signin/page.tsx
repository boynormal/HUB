import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { env, lineLoginConfigured, liffConfigured } from "@/server/env";
import { LiffSignIn } from "@/components/liff-sign-in";
import { AdminSignInForm } from "@/components/admin-sign-in-form";
import { ThemeToggle } from "@/components/theme-toggle";

const ERRORS: Record<string, string> = {
  state: "การเข้าสู่ระบบหมดอายุ กดเข้าสู่ระบบด้วย LINE อีกครั้ง",
  line: "เชื่อมต่อ LINE ไม่สำเร็จ ลองอีกครั้ง",
  line_not_configured: "ยังไม่ได้ตั้งค่าช่องทาง LINE ใช้รหัสผู้ดูแลระบบเข้าใช้งานก่อน",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getActor()) redirect("/");
  const { error } = await searchParams;
  const lineReady = lineLoginConfigured();

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
              <h1 className="text-xl font-semibold leading-tight">Hub ศูนย์กลางการสื่อสาร</h1>
              <p className="text-sm text-muted">เอส เจริญชัย กรุ๊ป</p>
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">
              {ERRORS[error] ?? "เข้าสู่ระบบไม่สำเร็จ"}
            </p>
          ) : null}

          <div className="mt-6">
            {liffConfigured() ? <LiffSignIn liffId={env().LIFF_ID} /> : null}

            {lineReady ? (
              <a
                href="/api/auth/line/start"
                className="thumb-zone flex items-center justify-center gap-2 rounded-full bg-[#06c755] px-4 text-base font-semibold text-white"
              >
                เข้าสู่ระบบด้วย LINE
              </a>
            ) : (
              <p className="rounded-2xl bg-surface-muted p-3 text-sm text-muted">
                ยังไม่ได้ตั้งค่าช่องทาง LINE ใช้รหัสผู้ดูแลระบบเข้าใช้งานก่อน
              </p>
            )}

            <p className="mt-3 text-center text-sm text-muted">
              เข้าครั้งแรก? ผูกบัญชีที่{" "}
              <Link href="/signin/link" className="font-medium text-accent underline">
                หน้าผูกบัญชี
              </Link>
            </p>
          </div>

          <details className="mt-5 rounded-2xl border border-line bg-surface-muted p-4">
            <summary className="cursor-pointer text-sm font-medium">
              เข้าสู่ระบบด้วยรหัสผู้ดูแลระบบ
            </summary>
            <AdminSignInForm />
          </details>
        </section>
        <p className="mt-4 text-center text-xs text-muted">
          ใช้ได้เฉพาะพนักงานของบริษัท ติดต่อฝ่ายบุคคลหากเข้าใช้งานไม่ได้
        </p>
      </div>
    </main>
  );
}
