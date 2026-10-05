import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/actor";
import { env, liffConfigured } from "@/server/env";
import { LinkAccountForm } from "@/components/link-account-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LinkAccountPage() {
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
            <h1 className="text-xl font-semibold leading-tight">ผูกบัญชี LINE กับพนักงาน</h1>
          </div>
          <p className="mt-3 text-sm text-muted">
            กรอกรหัสพนักงานและรหัสเชิญที่ได้รับจากฝ่ายบุคคล ทำครั้งเดียวต่อบัญชี
          </p>
          <LinkAccountForm liffId={liffConfigured() ? env().LIFF_ID : null} />
        </section>
        <p className="mt-4 text-center text-xs text-muted">
          ไม่มีรหัสเชิญ? ติดต่อฝ่ายบุคคลเพื่อขอรหัสใหม่
        </p>
      </div>
    </main>
  );
}
