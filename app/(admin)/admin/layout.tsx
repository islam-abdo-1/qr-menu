import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = {
  title: "لوحة الإدارة",
};

export const dynamic = "force-dynamic";

/**
 * حماية إضافية للوحة: webها بدون جلسة صالحة.
 * getUser() يتحقق من التوكن ويجدده تلقائيًا — فيصل المستخدم مصدَّقًا
 * من أول رندر للخادم، بلا أي وميض تحميل على العميل ولا حلقات إعادة توجيه.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, error } = await getCurrentUser();

  if (error || !user) {
    redirect("/login?next=/admin");
  }

  return children;
}