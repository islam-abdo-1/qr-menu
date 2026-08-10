"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Flame, Plus, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { applyDiscount } from "@/lib/utils";
import type { MenuCategory } from "@/lib/data";

type Props = {
  item: MenuCategory["items"][number];
  currency: string;
  locale: "ar" | "en";
  index?: number;
  delay?: number;
  themePrimary?: string;
  qtyInCart?: number;
  /** يُستدعى مع السعر النهائي المحسوب (بعد الخصم و/أو المقاس) — السلة لا تحسب شيئًا */
  onAdd?: (selection: { sizeCode?: string; price: number }) => void;
  bestSeller?: boolean;
};

export function ItemCard({
  item,
  currency,
  locale,
  index = 0,
  delay = 0,
  themePrimary,
  qtyInCart = 0,
  onAdd,
  bestSeller = false,
}: Props) {
  const sizes = item.sizes ?? [];
  const hasDiscount = (item.discountPercentage ?? 0) > 0;

  // المقاس المختار (إن وُجدت مقاسات) — يُصفَّر عند تغيّر العنصر
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  useEffect(() => {
    setSelectedSize(null);
  }, [item.id]);

  const selected = sizes.find((s) => s.sizeCode === selectedSize) ?? null;
  const basePrice = selected ? selected.price : item.price;
  const finalPrice = applyDiscount(basePrice, item.discountPercentage);
  const saveable = !sizes.length || selectedSize !== null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.06 + delay, 0.45), ease: "easeOut" }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_24px_60px_-24px_rgba(212,168,83,0.35)]"
    >
      {/* الصورة */}
      <div className="relative h-44 w-full overflow-hidden sm:h-48">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
            quality={75}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className="texture-dots-light flex h-full w-full items-center justify-center"
            style={{
              background: `radial-gradient(120% 120% at 50% 0%, ${themePrimary || "#C84C21"}55, transparent 60%), linear-gradient(160deg, #2A211A, #17120E)`,
            }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15 backdrop-blur-sm">
              <UtensilsCrossed className="h-7 w-7 text-gold" />
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />
        {/* شارة السعر النهائي */}
        <span
          className="absolute bottom-3 rounded-full bg-gradient-to-l from-gold to-[#a87a2b] px-3.5 py-1 text-xs font-black text-background shadow-md"
          style={{ insetInlineStart: "0.75rem" }}
        >
          {formatPrice(finalPrice, currency, locale)}
        </span>
        {bestSeller ? (
          <span
            className="absolute top-3 flex items-center gap-1 rounded-full border border-gold/50 bg-black/60 px-2.5 py-1 text-[10px] font-black text-gold backdrop-blur"
            style={{ insetInlineStart: "0.75rem" }}
          >
            <Flame className="h-3 w-3" />
            {locale === "ar" ? "الأكثر مبيعًا" : "Best seller"}
          </span>
        ) : null}
        {/* شارة الخصم */}
        {hasDiscount ? (
          <span
            className="absolute bottom-3 flex items-center gap-1 rounded-full border border-[#FF6B6B]/60 bg-[#EF4444]/90 px-2.5 py-1 text-[10px] font-black text-white shadow-lg backdrop-blur"
            style={{ insetInlineEnd: "0.75rem" }}
          >
            🔥 {item.discountPercentage}% OFF
          </span>
        ) : null}
        {!item.isAvailable ? (
          <span
            className="absolute top-3 rounded-full border border-border bg-black/60 px-2.5 py-1 text-[10px] font-bold text-cream/80 backdrop-blur"
            style={{ insetInlineEnd: "0.75rem" }}
          >
            {locale === "ar" ? "غير متاح" : "Unavailable"}
          </span>
        ) : null}
      </div>

      {/* التفاصيل */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-xl font-bold text-cream">
          {item.name}
        </h3>
        {item.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream/80 sm:text-[13px]">
            {item.description}
          </p>
        ) : null}

        {/* السعر: القديم مشطوبًا (عند الخصم) + النهائي */}
        <div className="mt-2.5 flex items-center gap-2">
          {hasDiscount && basePrice !== finalPrice ? (
            <del className="text-xs font-semibold text-cream/45">
              {formatPrice(basePrice, currency, locale)}
            </del>
          ) : null}
          <span className="text-sm font-black text-[#3ECF7A]">
            {formatPrice(finalPrice, currency, locale)}
          </span>
          {selected ? (
            <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-black text-gold">
              {selected.sizeCode}
            </span>
          ) : null}
        </div>

        {/* اختيار المقاس */}
        {sizes.length > 0 && item.isAvailable ? (
          <div className="mt-3 flex items-center gap-1.5">
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
                    "flex h-8 min-w-9 items-center justify-center rounded-lg border px-2 text-[11px] font-black transition-all active:scale-95",
                    isOn
                      ? "border-gold bg-gold/20 text-gold shadow-sm"
                      : "border-border bg-background/60 text-cream/70 hover:border-gold/50 hover:text-gold",
                  )}
                >
                  {s.sizeCode}
                </button>
              );
            })}
            {!selectedSize ? (
              <span className="ms-1 text-[10px] text-cream/50">
                {locale === "ar" ? "اختر المقاس" : "Pick a size"}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cream/65">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: item.isAvailable ? "#3ECF7A" : "#5A4F44" }}
              />
              {item.isAvailable
                ? locale === "ar"
                  ? "متاح الآن"
                  : "Available"
                : locale === "ar"
                  ? "غير متاح حاليًا"
                  : "Unavailable"}
            </div>
            {onAdd && item.isAvailable ? (
              <button
                type="button"
                disabled={!saveable}
                onClick={() => onAdd({ sizeCode: selectedSize ?? undefined, price: finalPrice })}
                aria-label={locale === "ar" ? "إضافة إلى السلة" : "Add to cart"}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-full border font-black transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40",
                  qtyInCart > 0
                    ? "border-gold/60 bg-gold/15 px-3.5 text-gold"
                    : "border-gold/30 bg-gold/10 px-3 text-cream hover:bg-gold/20 hover:text-gold",
                )}
              >
                <Plus className="h-4 w-4" />
                {qtyInCart > 0 ? (
                  <span className="text-xs">{qtyInCart}</span>
                ) : (
                  <span className="text-xs">
                    {locale === "ar" ? "أضف" : "Add"}
                  </span>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* لمسة زخرفية علوية */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-gold via-primary to-gold transition-transform duration-300 group-hover:scale-x-100"
        aria-hidden
      />
    </motion.article>
  );
}