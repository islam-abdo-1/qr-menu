"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Bike, Loader2, ReceiptText, Store, TrendingUp, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import {
  getSalesReportAction,
  type ReportPeriod,
  type SalesReport,
} from "@/lib/actions/reports";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "today", label: "اليوم" },
  { id: "7d", label: "آخر 7 أيام" },
  { id: "30d", label: "آخر 30 يوم" },
];

export function ReportsPanel() {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: ReportPeriod) => {
    setLoading(true);
    const res = await getSalesReportAction(p);
    setLoading(false);
    if (res.ok) setReport(res.data);
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  if (loading && !report) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-cream/60">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <p className="text-sm">جارٍ تحميل التقرير...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/50 py-24 text-center">
        <BarChart3 className="h-10 w-10 text-gold" />
        <p className="font-bold text-cream">تعذّر تحميل التقرير</p>
      </div>
    );
  }

  const { totals, byDay, bestSellers } = report;
  const maxDay = Math.max(...byDay.map((d) => d.revenue), 1);

  const statCards = [
    { label: "إجمالي المبيعات", value: formatPrice(totals.revenue, "EGP", "ar"), icon: Wallet, color: "text-gold" },
    { label: "عدد الطلبات", value: String(totals.orders), icon: ReceiptText, color: "text-sky-400" },
    { label: "متوسط الطلب", value: formatPrice(totals.avg, "EGP", "ar"), icon: TrendingUp, color: "text-[#3ECF7A]" },
  ];

  return (
    <div className="space-y-5">
      {/* اختيار الفترة */}
      <div className="flex w-fit gap-1 rounded-2xl border border-border bg-card p-1 shadow-soft">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-bold transition-all",
              period === p.id
                ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background shadow"
                : "text-cream/70 hover:text-cream",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* بطاقات الإجماليات */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-sm text-cream/65">
              <c.icon className={cn("h-4 w-4", c.color)} />
              {c.label}
            </div>
            <p className="mt-2 font-display text-2xl font-black text-cream">{c.value}</p>
          </div>
        ))}
      </div>

      {/* داخل المطعم / توصيل */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex items-center gap-2 text-sm font-bold text-cream/80">
            <Store className="h-4 w-4 text-gold" />
            داخل المطعم
          </span>
          <span className="font-display text-xl font-black text-cream">{totals.dineIn}</span>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex items-center gap-2 text-sm font-bold text-cream/80">
            <Bike className="h-4 w-4 text-gold" />
            توصيل
          </span>
          <span className="font-display text-xl font-black text-cream">{totals.delivery}</span>
        </div>
      </div>

      {/* الأعمدة اليومية */}
      {byDay.length > 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-cream">
            <BarChart3 className="h-4 w-4 text-gold" />
            المبيعات يومًا بيوم
          </h3>
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {byDay.map((d) => (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-1.5" title={`${d.label}: ${formatPrice(d.revenue, "EGP", "ar")}`}>
                <span className="text-[10px] font-bold text-cream/80 opacity-0 transition-opacity group-hover:opacity-100">
                  {formatPrice(d.revenue, "EGP", "ar")}
                </span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-gold to-[#e8c877] transition-all group-hover:brightness-110"
                  style={{ height: `${Math.max((d.revenue / maxDay) * 100, d.revenue > 0 ? 8 : 2)}%` }}
                />
                <span className="text-[10px] font-semibold text-cream/60">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-cream/60">
          لا توجد مبيعات في هذه الفترة بعد
        </div>
      )}

      {/* الأكثر مبيعًا */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-black text-cream">
          <Trophy className="h-4 w-4 text-gold" />
          الأكثر مبيعًا
        </h3>
        {bestSellers.length === 0 ? (
          <p className="text-sm text-cream/60">لا توجد أصناف مباعة في هذه الفترة</p>
        ) : (
          <div className="space-y-3">
            {bestSellers.map((b, i) => (
              <div key={b.name} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    i === 0
                      ? "bg-gradient-to-br from-gold to-[#a87a2b] text-background"
                      : "bg-cream/10 text-cream/70",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-cream">{b.name}</p>
                  <p className="text-xs text-cream/60">
                    {b.qty} × مبيعات — {formatPrice(b.revenue, "EGP", "ar")}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-black text-gold">{b.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
