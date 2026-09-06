"use client";

import {
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  Phone,
  Store,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { toImageProxyUrl } from "@/lib/utils";
import type { OrderStatus, OrderView } from "@/lib/actions/orders";

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  new: { label: "جديد", cls: "bg-gold/15 text-gold border-gold/30" },
  preparing: { label: "في التحضير", cls: "bg-[#3ECF7A]/15 text-[#3ECF7A] border-[#3ECF7A]/30" },
  done: { label: "تم التسليم", cls: "bg-cream/10 text-cream/60 border-border" },
};

function InfoRow({
  icon: Icon,
  label,
  value,
  ltr,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  ltr?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-cream/50">{label}</p>
        <p className="break-words text-sm font-semibold text-cream" dir={ltr ? "ltr" : undefined}>
          {value}
        </p>
      </div>
    </div>
  );
}

/** تفاصيل الطلب الكاملة (أدمن + موظفين) — معلومات منظمة مع صور الأصناف */
export function OrderDetailsDialog({
  order,
  currency,
  onClose,
}: {
  order: OrderView | null;
  currency: string;
  onClose: () => void;
}) {
  if (!order) return null;
  const meta = STATUS_META[order.status];
  const time = (d: Date) =>
    new Date(d).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  const date = (d: Date) =>
    new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long" });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`تفاصيل الطلب رقم ${order.number}`}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gold/25 bg-[#171310] p-6 shadow-elevated sm:rounded-3xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-cream/70 transition-colors hover:border-destructive/50 hover:text-destructive"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>

        {/* الترويسة */}
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-[#a87a2b] font-display text-2xl font-black text-background">
            {order.number}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-xl font-bold text-cream">
              {order.customerName || "زبون"}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                  meta.cls,
                )}
              >
                {order.type === "dine-in" ? (
                  <Store className="h-3 w-3" />
                ) : (
                  <Bike className="h-3 w-3" />
                )}
                {order.type === "dine-in"
                  ? order.tableNo
                    ? `طاولة ${order.tableNo}`
                    : "في المطعم"
                  : "توصيل"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                  meta.cls,
                )}
              >
                {meta.label}
              </span>
              {order.staffName ? (
                <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-bold text-cream/60">
                  {order.staffName}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* معلومات الزبون والطلب */}
        <div className="mt-5 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
          <InfoRow icon={Clock3} label="وقت الطلب" value={`${time(order.createdAt)} — ${date(order.createdAt)}`} />
          {order.status === "done" && order.completedAt ? (
            <InfoRow icon={CheckCircle2} label="وقت التسليم" value={`${time(order.completedAt)} — ${date(order.completedAt)}`} />
          ) : null}
          {order.phone ? <InfoRow icon={Phone} label="رقم الهاتف" value={order.phone} ltr /> : null}
          {order.address ? <InfoRow icon={MapPin} label="العنوان" value={order.address} /> : null}
          {order.notes ? <InfoRow icon={MessageSquare} label="ملاحظات" value={order.notes} /> : null}
        </div>

        {/* الأصناف مع الصور */}
        <p className="mt-5 mb-2 text-[11px] font-black tracking-wide text-cream/50">
          الأصناف ({order.items.length})
        </p>
        <ul className="space-y-2">
          {order.items.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3"
            >
              {i.imageUrl ? (
                <img
                  src={toImageProxyUrl(i.imageUrl, { width: 100, height: 100, quality: 80 })!}
                  alt={i.name}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-gold/30"
                  loading="lazy"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <UtensilsCrossed className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-cream">
                  <span className="truncate">{i.name}</span>
                  {i.sizeCode ? (
                    <span className="rounded-md border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-black text-gold">
                      {i.sizeCode}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-cream/55">
                  {formatPrice(i.price, currency, "ar")} × {i.qty}
                </p>
              </div>
              <p className="shrink-0 text-sm font-black text-gold">
                {formatPrice(i.price * i.qty, currency, "ar")}
              </p>
            </li>
          ))}
        </ul>

        {/* الإجمالي */}
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-gold/25 bg-gradient-to-l from-gold/15 to-transparent px-4 py-3">
          <span className="text-sm font-black text-cream">إجمالي الطلب</span>
          <span className="font-display text-xl font-black text-gold">
            {formatPrice(order.total, currency, "ar")}
          </span>
        </div>
      </div>
    </div>
  );
}