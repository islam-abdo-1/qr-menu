"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Phone, MapPin, MessageSquare, Clock3, Store, Bike } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { updateOrderStatusAction, type OrderStatus, type OrderView } from "@/lib/actions/orders";

const STATUS_META: Record<OrderStatus, { label: string; next: OrderStatus | null; cls: string }> = {
  new: { label: "جديد", next: "preparing", cls: "bg-gold/15 text-gold border-gold/30" },
  preparing: { label: "في التحضير", next: "done", cls: "bg-[#3ECF7A]/15 text-[#3ECF7A] border-[#3ECF7A]/30" },
  done: { label: "تم التسليم", next: null, cls: "bg-cream/10 text-cream/60 border-border" },
};

export function OrdersPanel({
  orders,
  onStatusChanged,
}: {
  orders: OrderView[] | null;
  onStatusChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function advance(orderId: string, status: OrderStatus) {
    setBusy(orderId);
    const res = await updateOrderStatusAction(orderId, status);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onStatusChanged();
  }

  if (!orders) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-cream/60">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
        <p className="text-sm">جارٍ تحميل الطلبات...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-card/50 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/10 text-gold">
          <Store className="h-8 w-8" />
        </div>
        <div>
          <p className="font-bold text-cream">لا توجد طلبات بعد</p>
          <p className="mt-1 text-sm text-cream/60">
            عندما يطلب زبون من منيوك سيظهر الطلب هنا فورًا
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((o) => {
        const meta = STATUS_META[o.status];
        return (
          <div
            key={o.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-gold/30"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] font-display text-lg font-black text-background">
                {o.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold text-cream">
                  {o.customerName || "زبون"}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black",
                      meta.cls,
                    )}
                  >
                    {o.type === "dine-in" ? (
                      <Store className="h-3 w-3" />
                    ) : (
                      <Bike className="h-3 w-3" />
                    )}
                    {o.type === "dine-in"
                      ? o.tableNo
                        ? `طاولة ${o.tableNo}`
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
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cream/60">
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-gold" />
                    {new Date(o.createdAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {o.status === "done" && o.completedAt ? (
                    <span className="flex items-center gap-1 text-[#3ECF7A]">
                      <CheckCircle2 className="h-3 w-3" />
                      تم التسليم في{" "}
                      {new Date(o.completedAt).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : null}
                  {o.phone ? (
                    <span className="flex items-center gap-1" dir="ltr">
                      <Phone className="h-3 w-3 text-gold" />
                      {o.phone}
                    </span>
                  ) : null}
                  {o.address ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-gold" />
                      {o.address}
                    </span>
                  ) : null}
                  {o.notes ? (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-gold" />
                      {o.notes}
                    </span>
                  ) : null}
                </p>
                {o.staffName ? (
                  <p className="mt-1 text-[11px] font-bold text-cream/50">
                    آخر من تعامل مع الطلب: {o.staffName}
                  </p>
                ) : null}
              </div>
              <p className="text-lg font-black text-gold">
                {formatPrice(o.total, "EGP", "ar")}
              </p>
            </div>

            <ul className="mt-4 space-y-1.5 border-t border-border/70 pt-3">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-gold/15 px-1 text-[11px] font-black text-gold">
                    {i.qty}
                  </span>
                  <span className="text-cream/85">{i.name}</span>
                  <span className="ms-auto text-xs text-cream/50">
                    {formatPrice(i.price * i.qty, "EGP", "ar")}
                  </span>
                </li>
              ))}
            </ul>

            {meta.next ? (
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => advance(o.id, meta.next!)}
                className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gold/40 bg-gold/10 text-sm font-black text-gold transition-all hover:bg-gold/20 active:scale-[0.99] disabled:opacity-60"
              >
                {busy === o.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {o.status === "new" ? "بدء التحضير" : "تم التسليم"}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
