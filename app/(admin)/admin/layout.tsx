import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "لوحة الإدارة",
};

export const dynamic = "force-dynamic";

/** حماية إضافية للوحة: تعطيل أي وصول بدون جلسة صالحة */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return children;
}