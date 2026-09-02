import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "إنشاء مطعم — QR Menu",
};

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const rows = await prisma.siteSetting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  // التسجيل مغلق افتراضيًا — يُفتح فقط بإعداد صريح "true" من لوحة المالك
  const signupOpen = map.signupOpen === "true";

  return (
    <main className="texture-dots relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* زخارف خلفية */}
      <div className="pointer-events-none absolute -start-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-gold/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -end-32 bottom-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />

      <div className="relative w-full max-w-md">
        <SignupForm signupOpen={signupOpen} />
      </div>
    </main>
  );
}