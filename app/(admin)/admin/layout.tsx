import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hasValidSession } from "@/lib/session";

export const metadata = {
  title: "لوحة الإدارة",
};

export const dynamic = "force-dynamic";

/**
 * حماية إضافية للوحة: الوصول فقط لجلسة صالحة.
 * التحقق هنا محلي (فك JWT) — لا استدعاء شبكة getUser() ثانٍ، لأن الـ middleware
 * هو النقطة الوحيدة التي تجدّد الجلسة؛ الاستدعاء المزدوج كان يسبب سباق تدوير
 * refresh token → طرد غير مبرر لصفحة الدخول.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasValidSession(cookies().getAll())) {
    redirect("/login?next=/admin");
  }

  return children;
}