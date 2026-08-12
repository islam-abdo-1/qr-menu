import Link from "next/link";
import { getAdminData } from "@/lib/data";
import { AdminShell } from "@/components/admin/admin-shell";
import { SuspendedCard } from "@/components/admin/suspended-card";
import { SubscribeCard } from "@/components/admin/subscribe-card";
import { Store } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminData();

  if (data?.restaurant.blocked) {
    return <SuspendedCard />;
  }

  if (data?.billingStatus === "expired") {
    return <SubscribeCard />;
  }

  if (!data) {
    return (
      <main className="texture-dots flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-border bg-card p-10 text-center shadow-elevated">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-gold">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gold-gradient">
            لا يوجد مطعم مرتبط بحسابك
          </h1>
          <p className="text-sm text-cream/75">
            أنشئ مطعمك للحصول على رابط منيو خاص به ولوحة تحكم كاملة.
          </p>
          <Link
            href="/signup"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            إنشاء مطعم جديد
          </Link>
        </div>
      </main>
    );
  }

  return <AdminShell data={data} />;
}
