import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { sessionUserStatus } from "@/server/shell";
import { env, liffConfigured } from "@/server/env";
import { LiffSignIn } from "@/components/liff-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";

const ERRORS: Record<string, string> = {
  state: "การเข้าสู่ระบบหมดอายุ กดปุ่มด้านล่างอีกครั้ง",
  line: "เชื่อมต่อ LINE ไม่สำเร็จ ลองอีกครั้ง",
  line_not_configured: "ยังไม่ได้ตั้งค่าช่องทาง LINE",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getActor()) redirect("/");
  if ((await sessionUserStatus()) === "INVITED") redirect("/signin/pending");
  const { error } = await searchParams;

  return (
    <main className="auth-screen relative flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="absolute end-4 top-4 z-10">
        <ThemeToggle compact className="iphone-glass border-0 bg-transparent px-3 shadow-none" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <section className="iphone-glass px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-accent text-xl font-bold text-accent-ink shadow-[var(--shadow-panel)]">
              H
            </span>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Hub ศูนย์กลางการสื่อสาร</h1>
              <p className="mt-0.5 text-sm text-muted">ส.เจริญชัย รีไซเคิล</p>
            </div>
          </div>

          {error ? (
            <p role="alert" className="mt-5 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
              {ERRORS[error] ?? "เข้าสู่ระบบไม่สำเร็จ"}
            </p>
          ) : null}

          <div className="mt-8">
            {liffConfigured() ? <LiffSignIn liffId={env().LIFF_ID} /> : null}
            <p className="mb-5 text-sm leading-relaxed text-muted">
              กดปุ่มนี้ด้วยบัญชี LINE ของคุณ ครั้งแรกฝ่ายบุคคลจะอนุมัติให้ก่อน ครั้งต่อไปกดปุ่มแล้วเข้าได้เลย
            </p>
            <a
              href="/api/auth/line/start"
              className="thumb-zone flex items-center justify-center gap-2 rounded-full bg-[#06c755] px-4 text-base font-semibold text-white shadow-[0_10px_24px_-12px_rgba(6,199,85,0.9)]"
            >
              เข้าสู่ระบบด้วย LINE
            </a>
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted">
          ใช้ได้เฉพาะพนักงานของบริษัท{" "}
          <Link href="/signin/admin" className="underline">
            ผู้ดูแลระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
