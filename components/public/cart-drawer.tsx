"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "@/lib/cart";
import { cartCount, cartTotal } from "@/lib/cart";
import { createOrderAction } from "@/lib/actions/orders";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  locale: "ar" | "en";
  currency: string;
  items: CartItem[];
  onUpdateQty: (itemId: string, qty: number) => void;
  onRemove: (itemId: string) => void;
  onOrderPlaced: () => void;
};

const t = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

type Step = "cart" | "checkout" | "success";

export function CartDrawer({
  open,
  onOpenChange,
  slug,
  locale,
  currency,
  items,
  onUpdateQty,
  onRemove,
  onOrderPlaced,
}: Props) {
  const [step, setStep] = useState<Step>("cart");
  const [type, setType] = useState<"dine-in" | "delivery">("dine-in");
  const [customerName, setCustomerName] = useState("");
  const [tableNo, setTableNo] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  const total = useMemo(() => cartTotal(items), [items]);
  const count = useMemo(() => cartCount(items), [items]);

  // عند مسح رمز QR الخاص بالطاولة (مثل /m/kafy?table=5) نملأ رقم الطاولة تلقائيًا
  useEffect(() => {
    if (!open || tableNo) return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("table");
    if (t && /^\d{1,3}$/.test(t)) setTableNo(t);
  }, [open, tableNo]);

  const reset = () => {
    setStep("cart");
    setType("dine-in");
    setCustomerName("");
    setTableNo("");
    setPhone("");
    setAddress("");
    setNotes("");
    setError(null);
    setOrderNumber(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  async function submitOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createOrderAction({
      restaurantSlug: slug,
      customerName,
      type,
      tableNo: type === "dine-in" ? tableNo : undefined,
      phone: type === "delivery" ? phone : undefined,
      address: type === "delivery" ? address : undefined,
      notes: notes || undefined,
      items: items.map((i) => ({ itemId: i.itemId, qty: i.qty })),
    });
    setLoading(false);
    if (res.ok) {
      setOrderNumber(res.data.number);
      setStep("success");
      onOrderPlaced();
    } else {
      setError(res.error);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" dir={locale === "ar" ? "rtl" : "ltr"}>
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleOpenChange(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: locale === "ar" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: locale === "ar" ? "-100%" : "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: "easeOut" }}
            className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-gold/20 bg-[#171310] shadow-2xl"
          >
            {/* الترويسة */}
            <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-black text-cream">
                <ShoppingBag className="h-5 w-5 text-gold" />
                {t(locale, "سلة الطلب", "Your order")}
                {count > 0 ? (
                  <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-bold text-gold">
                    {count}
                  </span>
                ) : null}
              </h3>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-cream/70 transition-colors hover:text-gold"
                aria-label={t(locale, "إغلاق", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === "cart" && (
              <>
                {/* العناصر */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {items.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-gold/25 bg-gold/10 text-gold">
                        <ShoppingBag className="h-8 w-8" />
                      </div>
                      <p className="font-bold text-cream/80">
                        {t(locale, "سلتك فارغة", "Your cart is empty")}
                      </p>
                      <p className="max-w-[220px] text-xs text-cream/60">
                        {t(
                          locale,
                          "اضغط على «أضف» بجانب أي طبق لطلبه",
                          "Tap «Add» on any dish to order it",
                        )}
                      </p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((i) => (
                        <li
                          key={i.itemId}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                        >
                          <div className="flex flex-1 flex-col gap-1">
                            <p className="text-sm font-bold text-cream">{i.name}</p>
                            <p className="text-xs font-semibold text-gold">
                              {formatPrice(i.price, currency, locale)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 rounded-full border border-gold/25 bg-background p-0.5">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(i.itemId, i.qty - 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-gold/15 hover:text-gold active:scale-90"
                                aria-label="−"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-black text-gold">
                                {i.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(i.itemId, i.qty + 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-gold/15 hover:text-gold active:scale-90"
                                aria-label="+"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemove(i.itemId)}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-cream/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={t(locale, "حذف", "Remove")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* الملخص */}
                {items.length > 0 ? (
                  <div className="border-t border-gold/15 px-5 py-4">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="font-bold text-cream/75">
                        {t(locale, "الإجمالي", "Total")}
                      </span>
                      <span className="text-lg font-black text-gold">
                        {formatPrice(total, currency, locale)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("checkout")}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98]"
                    >
                      {t(locale, "متابعة الطلب", "Checkout")}
                    </button>
                  </div>
                ) : null}
              </>
            )}

            {step === "checkout" && (
              <form onSubmit={submitOrder} className="flex flex-1 flex-col overflow-y-auto px-5 py-4" noValidate>
                <div className="flex gap-1.5 rounded-xl border border-border bg-background p-1">
                  {(
                    [
                      { id: "dine-in", label: t(locale, "في المطعم", "Dine in") },
                      { id: "delivery", label: t(locale, "توصيل", "Delivery") },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setType(o.id)}
                      className={cn(
                        "flex-1 rounded-lg py-2.5 text-sm font-bold transition-all active:scale-[0.98]",
                        type === o.id
                          ? "bg-gradient-to-l from-gold to-[#a87a2b] text-background"
                          : "text-cream/60 hover:text-gold",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t(locale, "اسمك", "Your name")}
                    required
                    className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                  />
                  {type === "dine-in" ? (
                    <input
                      value={tableNo}
                      onChange={(e) => setTableNo(e.target.value)}
                      placeholder={t(locale, "رقم الطاولة", "Table number")}
                      required
                      inputMode="numeric"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                    />
                  ) : (
                    <>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t(locale, "رقم الهاتف", "Phone number")}
                        required
                        inputMode="tel"
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                      />
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={t(locale, "العنوان", "Delivery address")}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                      />
                    </>
                  )}
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t(locale, "ملاحظات (اختياري)", "Notes (optional)")}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none transition-all focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                {error && (
                  <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}

                <div className="mt-auto pt-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-bold text-cream/75">
                      {t(locale, "الإجمالي", "Total")}
                    </span>
                    <span className="text-lg font-black text-gold">
                      {formatPrice(total, currency, locale)}
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#a87a2b] font-black text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading
                      ? t(locale, "جارٍ الإرسال...", "Sending...")
                      : t(locale, "إرسال الطلب", "Place order")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("cart")}
                    className="mt-2 h-11 w-full rounded-xl text-sm font-bold text-cream/60 transition-colors hover:text-gold"
                  >
                    {t(locale, "رجوع", "Back")}
                  </button>
                </div>
              </form>
            )}

            {step === "success" && (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3ECF7A]/15 text-[#3ECF7A]"
                >
                  <CheckCircle2 className="h-10 w-10" />
                </motion.div>
                <div>
                  <p className="font-display text-2xl font-bold text-gold-gradient">
                    {t(locale, "تم استلام طلبك!", "Order received!")}
                  </p>
                  <p className="mt-2 text-sm text-cream/70">
                    {t(
                      locale,
                      "رقم طلبك — أبلغ الموظف به عند الطاولة",
                      "Your order number — tell the staff",
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-gold/30 bg-gold/10 px-10 py-4">
                  <span className="font-display text-5xl font-black text-gold">
                    {orderNumber}
                  </span>
                </div>
                <p className="text-xs text-cream/55">
                  {t(
                    locale,
                    "سنحضّر طلبك فورًا — شكرًا لزيارتك",
                    "We'll prepare your order right away — thank you!",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="h-11 w-full max-w-[240px] rounded-xl border border-gold/30 bg-gold/10 font-black text-gold transition-all hover:bg-gold/20 active:scale-[0.98]"
                >
                  {t(locale, "تمام", "Done")}
                </button>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
