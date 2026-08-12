"use client";

import { useState } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { signOutAction } from "@/lib/actions/auth";
import { subscribeAction } from "@/lib/actions/billing";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/lib/billing-constants";

export function SubscribeCard() {
  const [loading, setLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<"monthly" | "annual" | null>(null);

  async function handleSignOut() {
    setLoading(true);
    await signOutAction();
    window.location.href = "/login";
  }

  async function handleSubscribe(plan: "monthly" | "annual") {
    setPendingPlan(plan);
    const res = await subscribeAction(plan);
    setPendingPlan(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data?.iframeUrl) {
      window.location.href = res.data.iframeUrl;
    }
  }

  return (
    <main className="texture-dots flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-elevated">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <CreditCard className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gold-gradient">
            انتهت الفترة المجانية
          </h1>
          <p className="text-sm text-cream/75">
            اشترك لاستكمال استخدام لوحة الإدارة والموظفين. قائمتك العامة تبقى متاحة
            للعملاء دائمًا.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-cream">شهري</p>
              <p className="font-display text-lg font-black text-gold">
                {MONTHLY_PRICE} ج.م
              </p>
            </div>
            <p className="mt-1 text-xs text-cream/60">
              تجديد تلقائي كل شهر — يمكنك الإلغاء في أي وقت
            </p>
          </div>
          <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-cream">سنوي</p>
              <p className="font-display text-lg font-black text-gold">
                {ANNUAL_PRICE} ج.م
              </p>
            </div>
            <p className="mt-1 text-xs text-cream/60">
              وفّر {Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100)}٪ — سنة كاملة بسعر 11 شهرًا
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs text-cream/70">
          <Wallet className="h-4 w-4 shrink-0 text-gold" />
          <p>
            الدفع عبر فودافون كاش وفوري — الدفع الإلكتروني متاح قريبًا، حاليًا تواصل مع
            الإدارة للتفعيل.
          </p>
        </div>

        <button
          type="button"
          disabled={pendingPlan !== null}
          onClick={() => handleSubscribe("monthly")}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {pendingPlan === "monthly" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {pendingPlan === "monthly" ? "جارٍ تجهيز الدفع..." : "اشترك الآن"}
        </button>

        <button
          type="button"
          disabled={pendingPlan !== null}
          onClick={() => handleSubscribe("annual")}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 font-black text-gold transition-all hover:bg-gold/20 active:scale-[0.98] disabled:opacity-60"
        >
          {pendingPlan === "annual" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {pendingPlan === "annual" ? "جارٍ تجهيز الدفع..." : "اشترك سنويًا (الأوفر)"}
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading || pendingPlan !== null}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border font-bold text-cream/80 transition-colors hover:bg-background/60 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          تسجيل الخروج
        </button>
      </div>
    </main>
  );
}