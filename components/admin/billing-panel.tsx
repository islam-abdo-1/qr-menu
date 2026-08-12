"use client";

import { useState } from "react";
import { BadgeCheck, CreditCard, Loader2, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MONTHLY_PRICE, ANNUAL_PRICE } from "@/lib/billing-constants";
import { subscribeAction } from "@/lib/actions/billing";
import type { AdminData } from "@/components/admin/types";

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(d));
}

export function BillingPanel({ data }: { data: AdminData }) {
  const { billingStatus, trialDaysLeft, billingEnabled } = data;
  const [pendingPlan, setPendingPlan] = useState<"monthly" | "annual" | null>(null);

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
    <div className="flex flex-col gap-6">
      {/* بطاقة الحالة */}
      <div className="rounded-3xl border border-gold/20 bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          {billingStatus === "exempt" ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
              <ShieldCheck className="h-6 w-6" />
            </div>
          ) : billingStatus === "trial" ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
              <Sparkles className="h-6 w-6" />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <BadgeCheck className="h-6 w-6" />
            </div>
          )}
          <div>
            <p className="text-sm text-cream/60">حالة اشتراكك</p>
            <p className="font-display text-lg font-black text-gold-gradient">
              {billingStatus === "exempt" && "مستثنى نهائيًا — لا يلزمك اشتراك"}
              {billingStatus === "trial" &&
                `تجربة مجانية — تنتهي بعد ${trialDaysLeft} ${trialDaysLeft === 1 ? "يوم" : "أيام"}`}
              {billingStatus === "active" &&
                (data.restaurant.paidUntil
                  ? `مشترك — ساري حتى ${formatDate(data.restaurant.paidUntil)}`
                  : billingEnabled
                    ? "اشتراكك نشط"
                    : "حسابك نشط — الفوترة غير مفعّلة بعد")}
            </p>
            {billingStatus === "trial" && (
              <p className="mt-1 text-xs text-cream/60">
                ينتهي في {formatDate(data.restaurant.trialEndsAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* الخطط */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col rounded-3xl border border-gold/25 bg-card p-6 shadow-soft">
          <p className="font-bold text-cream">الخطة الشهرية</p>
          <p className="mt-2 font-display text-3xl font-black text-gold">{MONTHLY_PRICE} ج.م</p>
          <p className="mt-1 text-xs text-cream/60">كل شهر — أسبوع مجاني لكل مطعم جديد</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-cream/80">
            <li>• منيو رقمي كامل + QR</li>
            <li>• لوحة إدارة + شاشة موظفين</li>
            <li>• طلبات وفواتير وتقارير</li>
          </ul>
        </div>
        <div className="relative flex flex-col rounded-3xl border border-gold bg-card p-6 shadow-soft">
          <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-gold to-[#a87a2b] px-3 py-1 text-[11px] font-black text-background">
            الأوفر
          </span>
          <p className="font-bold text-cream">الخطة السنوية</p>
          <p className="mt-2 font-display text-3xl font-black text-gold">{ANNUAL_PRICE} ج.م</p>
          <p className="mt-1 text-xs text-cream/60">
            وفّر {Math.round((1 - ANNUAL_PRICE / (MONTHLY_PRICE * 12)) * 100)}٪ — سنة كاملة بسعر 11
            شهرًا
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm text-cream/80">
            <li>• كل مميزات الشهري</li>
            <li>• سعر أقل شهريًا</li>
            <li>• أولوية الدعم الفني</li>
          </ul>
        </div>
      </div>

      {/* وسائل الدفع + قريبًا */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-gold" />
          <p className="font-bold text-cream">وسائل الدفع</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-bold text-cream/80">
            فودافون كاش
          </span>
          <span className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-bold text-cream/80">
            فوري
          </span>
          <span className="rounded-full border border-border bg-background/60 px-4 py-1.5 text-xs font-bold text-cream/60">
            البطاقات البنكية (قريبًا)
          </span>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-xs text-cream/70">
          <CreditCard className="h-4 w-4 shrink-0 text-gold" />
          <p>
            الدفع عبر فودافون كاش وفوري — البوابة في طريقها للتفعيل، حتى ذلك الحين تواصل مع
            الإدارة لتسجيل اشتراكك (شهريًا أو سنويًا).
          </p>
        </div>
        <button
          type="button"
          disabled={pendingPlan !== null || data.billingStatus === "exempt"}
          onClick={() => handleSubscribe("monthly")}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
        >
          {pendingPlan === "monthly" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {pendingPlan === "monthly" ? "جارٍ تجهيز الدفع..." : "اشترك الآن (شهري)"}
        </button>
        <button
          type="button"
          disabled={pendingPlan !== null || data.billingStatus === "exempt"}
          onClick={() => handleSubscribe("annual")}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 font-black text-gold transition-all hover:bg-gold/20 active:scale-[0.98] disabled:opacity-60"
        >
          {pendingPlan === "annual" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {pendingPlan === "annual" ? "جارٍ تجهيز الدفع..." : "اشترك الآن (سنوي)"}
        </button>
      </div>
    </div>
  );
}