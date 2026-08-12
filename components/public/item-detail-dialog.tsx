"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, UtensilsCrossed, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { applyDiscount } from "@/lib/utils";
import type { MenuCategory } from "@/lib/data";

type Props = {
  item: MenuCategory["items"][number] | null;
  currency: string;
  locale: "ar" | "en";
  themePrimary?: string;
  logoUrl?: string | null;
  qtyInCart?: number;
  onAdd?: (selection: { sizeCode?: string; price: number }) => void;
  onClose: () => void;
};

/** نافذة تفاصيل المنتج: Bottom Sheet على الموبايل / نافذة متوسطة على الكمبيوتر */
export function ItemDetailDialog({
  item,
  currency,
  locale,
  themePrimary,
  logoUrl,
  qtyInCart = 0,
  onAdd,
  onClose,
}: Props) {
  const open = item !== null;
  const sizes = item?.sizes ?? [];
  const hasDiscount = (item?.discountPercentage ?? 0) > 0;

  // المقاس المختار — يُصفَّر عند فتح صنف مختلف
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  useEffect(() => {
    setSelectedSize(null);
  }, [item?.id]);

  // قفل تمرير الصفحة أثناء الفتح + إغلاق بزر Esc
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!item) return null;

  const selected = sizes.find((s) => s.sizeCode === selectedSize) ?? null;
  const basePrice = selected ? selected.price : item.price;
  const finalPrice = applyDiscount(basePrice, item.discountPercentage);
  const saveable = !sizes.length || selectedSize !== null;

  const handleAdd = () => {
    if (!saveable || !onAdd) return;
    onAdd({ sizeCode: selectedSize ?? undefined, price: finalPrice });
  };

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          {/* الخلفية */}
          <motion.button
            type="button"
            aria-label={locale === "ar" ? "إغلاق" : "Close"}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 w-full cursor-pointer bg-black/70"
          />

          {/* اللوحة */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-gold/25 bg-card shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] will-change-transform sm:inset-0 sm:my-auto sm:max-h-[80vh] sm:rounded-3xl"
          >
            {/* الصورة */}
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#1A1510]">
              {item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 512px"
                  loading="eager"
                  quality={85}
                  className="object-cover"
                />
              ) : (
                <div
                  className="texture-dots flex h-full w-full items-center justify-center"
                  style={{
                    background: `radial-gradient(120% 120% at 50% 0%, ${themePrimary || "#C84C21"}55, transparent 60%), linear-gradient(160deg, #2A211A, #17120E)`,
                  }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      aria-hidden
                      className="h-20 w-20 rounded-full border-2 border-gold/50 bg-[#14100D] object-cover opacity-90"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15">
                      <UtensilsCrossed className="h-8 w-8 text-gold" />
                    </div>
                  )}
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent"
                aria-hidden
              />
              {/* شارة الخصم */}
              {hasDiscount ? (
                <span className="absolute bottom-3 start-3 rounded-full border border-[#FF6B6B]/60 bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-black text-white shadow-lg">
                  🔥 {item.discountPercentage}% OFF
                </span>
              ) : null}
              {!item.isAvailable ? (
                <span className="absolute top-3 start-3 rounded-full border border-border bg-black/60 px-2.5 py-1 text-[10px] font-bold text-cream/80">
                  {locale === "ar" ? "غير متاح حاليًا" : "Unavailable"}
                </span>
              ) : null}
              {/* زر الإغلاق */}
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === "ar" ? "إغلاق" : "Close"}
                className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-black/60 text-cream backdrop-blur transition-all hover:bg-black/80 hover:text-gold active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* المحتوى */}
            <div className="overscroll-contain flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
              <h2 className="font-display text-2xl font-bold text-gold-gradient">{item.name}</h2>
              {item.description ? (
                <p className="mt-2 text-sm leading-relaxed text-cream/80">{item.description}</p>
              ) : null}

              {/* المقاسات */}
              {sizes.length > 0 && item.isAvailable ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold text-cream/65">
                    {locale === "ar" ? "اختر المقاس" : "Pick a size"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {sizes.map((s) => {
                      const isOn = selectedSize === s.sizeCode;
                      const sFinal = applyDiscount(s.price, item.discountPercentage);
                      return (
                        <button
                          key={s.sizeCode}
                          type="button"
                          onClick={() => setSelectedSize(isOn ? null : s.sizeCode)}
                          aria-pressed={isOn}
                          title={`${s.sizeCode} — ${formatPrice(sFinal, currency, locale)}`}
                          className={cn(
                            "flex h-10 min-w-12 items-center justify-center rounded-xl border px-3 text-xs font-black transition-all active:scale-95",
                            isOn
                              ? "border-gold bg-gold/20 text-gold shadow-sm"
                              : "border-border bg-background/60 text-cream/70 hover:border-gold/50 hover:text-gold",
                          )}
                        >
                          {s.sizeCode}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* السعر: قبل الاختيار «بدءًا من» أقل مقاس — بعد الاختيار سعر المقاس فقط */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {selected ? (
                  <>
                    {hasDiscount && basePrice !== finalPrice ? (
                      <del className="text-sm font-semibold text-cream/45">
                        {formatPrice(basePrice, currency, locale)}
                      </del>
                    ) : null}
                    <span className="text-xl font-black text-[#3ECF7A]">
                      {formatPrice(finalPrice, currency, locale)}
                    </span>
                    <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-black text-gold">
                      {selected.sizeCode}
                    </span>
                  </>
                ) : sizes.length > 0 ? (
                  <span className="text-base font-black text-gold">
                    {locale === "ar" ? "بدءًا من" : "From"}{" "}
                    {formatPrice(
                      Math.min(...sizes.map((s) => applyDiscount(s.price, item.discountPercentage))),
                      currency,
                      locale,
                    )}
                  </span>
                ) : (
                  <>
                    {hasDiscount && basePrice !== finalPrice ? (
                      <del className="text-sm font-semibold text-cream/45">
                        {formatPrice(basePrice, currency, locale)}
                      </del>
                    ) : null}
                    <span className="text-xl font-black text-[#3ECF7A]">
                      {formatPrice(finalPrice, currency, locale)}
                    </span>
                  </>
                )}
                {!item.isAvailable ? (
                  <span className="ms-auto rounded-full border border-border bg-background/60 px-2.5 py-1 text-[10px] font-bold text-cream/70">
                    {locale === "ar" ? "غير متاح" : "Unavailable"}
                  </span>
                ) : null}
              </div>

              {/* زر الإضافة */}
              <button
                type="button"
                disabled={!saveable || !onAdd}
                onClick={handleAdd}
                className={cn(
                  "mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                  qtyInCart > 0
                    ? "border border-gold/60 bg-gold/15 text-gold"
                    : "bg-gradient-to-l from-gold to-[#a87a2b] text-background shadow-[0_12px_36px_-10px_rgba(212,168,83,0.55)] hover:brightness-110",
                )}
              >
                {qtyInCart > 0 ? (
                  <>
                    <Plus className="h-4 w-4" />
                    {locale === "ar" ? `في السلة: ${qtyInCart}` : `In cart: ${qtyInCart}`}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {locale === "ar" ? "أضف إلى السلة" : "Add to cart"}
                  </>
                )}
              </button>
              {!saveable && sizes.length > 0 ? (
                <p className="mt-2 text-center text-xs text-cream/55">
                  {locale === "ar" ? "اختر المقاس أولًا" : "Pick a size first"}
                </p>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
