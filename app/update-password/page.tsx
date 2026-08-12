import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "تعيين كلمة مرور جديدة",
};

export const dynamic = "force-dynamic";

export default function UpdatePasswordPage() {
  return (
    <main className="texture-dots relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute -start-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-gold/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -end-32 bottom-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />

      <div className="relative w-full max-w-md">
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
