"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
  themePrimary?: string;
  logoUrl?: string | null;
  qtyInCart?: number;
  /** يُستدعى مع السعر النهائي المحسوب (بعد الخصم و/أو المقاس) — السلة لا تحسب شيئًا */
  onAdd?: (selection: { sizeCode?: string; price: number }) => void;
  /** فتح نافذة تفاصيل المنتج — الضغط على أي منطقة من الكارت (غير الأزرار) */
  onOpenDetails?: () => void;
  bestSeller?: boolean;
};

export function ItemCard({
  item,
  currency,
  locale,
  index = 0,
  themePrimary,
  logoUrl,
  qtyInCart = 0,
  onAdd,
  onOpenDetails,
  bestSeller = false,
}: Props) {
  const sizes = useMemo(() => item.sizes ?? [], [item.sizes]);
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

  // Memoized size price formatting for button tooltips
  const formattedSizePrices = useMemo(
    () => new Map(sizes.map((s) => [s.sizeCode, formatPrice(applyDiscount(s.price, item.discountPercentage), currency, locale)])),
    [sizes, item.discountPercentage, currency, locale]
  );

  // Memoized price formatting to avoid repeated calculations
  const formattedFinalPrice = useMemo(
    () => formatPrice(finalPrice, currency, locale),
    [finalPrice, currency, locale]
  );
  const formattedBasePrice = useMemo(
    () => formatPrice(basePrice, currency, locale),
    [basePrice, currency, locale]
  );
  const formattedMinSizePrice = useMemo(
    () =>
      sizes.length > 0
        ? formatPrice(
            Math.min(...sizes.map((s) => applyDiscount(s.price, item.discountPercentage))),
            currency,
            locale
          )
        : null,
    [sizes, item.discountPercentage, currency, locale]
  );

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_24px_60px_-24px_rgba(212,168,83,0.35)]",
        "animate-fade-in-up"
      )}
      onClick={onOpenDetails}
      onKeyDown={(e) => {
        if (onOpenDetails && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpenDetails();
        }
      }}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      aria-label={onOpenDetails ? (locale === "ar" ? `عرض تفاصيل ${item.name}` : `View details for ${item.name}`) : undefined}
    >
      {/* الصورة — عبر Image Proxy للتخزين المؤقت والتحسين */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={`/api/image?url=${encodeURIComponent(item.imageUrl)}&w=400&q=75`}
            alt={item.name}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
            loading={index < 6 ? "eager" : "lazy"}
            fetchPriority={index < 6 ? "high" : "auto"}
            unoptimized
            placeholder="blur"
            blurDataURL={item.imageBlurDataURL ?? undefined}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div
            className="texture-dots-light flex h-full w-full items-center justify-center"
            style={{
              background: `radial-gradient(120% 120% at 50% 0%, ${themePrimary || "#C84C21"}55, transparent 60%), linear-gradient(160deg, #2A211A, #17120E)`,
            }}
          >
            {logoUrl ? (
              /* لوجو المطعم — يظهر لأي صنف بلا صورة مرفوعة */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                aria-hidden
                className="h-16 w-16 rounded-full border-2 border-gold/50 bg-[#14100D] object-cover opacity-90"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/15">
                <UtensilsCrossed className="h-7 w-7 text-gold" />
              </div>
            )}
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
            className="absolute top-3 flex items-center gap-1 rounded-full border border-gold/50 bg-black/60 px-2.5 py-1 text-[10px] font-black text-gold"
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
            className="absolute top-3 rounded-full border border-border bg-black/60 px-2.5 py-1 text-[10px] font-bold text-cream/80"
            style={{ insetInlineEnd: "0.75rem" }}
          >
            {locale === "ar" ? "غير متاح" : "Unavailable"}
          </span>
        ) : null}
      </div>

      {/* التفاصيل */}
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 font-display text-base font-bold leading-snug text-cream sm:text-xl">
          {item.name}
        </h3>
        {item.description ? (
          <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-cream/80 sm:line-clamp-2 sm:text-[13px]">
            {item.description}
          </p>
        ) : null}

        {/* السعر: قبل الاختيار «بدءًا من» أقل مقاس — بعد الاختيار سعر المقاس فقط */}
        <div className="mt-2 flex items-center gap-1.5">
          {selected ? (
            <>
              {hasDiscount && basePrice !== finalPrice ? (
                <del className="text-[11px] font-semibold text-cream/45 sm:text-xs">
                  {formattedBasePrice}
                </del>
              ) : null}
              <span className="text-sm font-black text-[#3ECF7A] sm:text-base">
                {formattedFinalPrice}
              </span>
              <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[10px] font-black text-gold">
                {selected.sizeCode}
              </span>
            </>
          ) : sizes.length > 0 ? (
            <span className="text-[11px] font-black text-gold sm:text-xs">
              {locale === "ar" ? "بدءًا من" : "From"}{" "}
              {formattedMinSizePrice}
            </span>
          ) : (
            <>
              {hasDiscount && basePrice !== finalPrice ? (
                <del className="text-[11px] font-semibold text-cream/45 sm:text-xs">
                  {formattedBasePrice}
                </del>
              ) : null}
              <span className="text-sm font-black text-[#3ECF7A] sm:text-base">
                {formattedFinalPrice}
              </span>
            </>
          )}
        </div>

        {/* اختيار المقاس */}
        {sizes.length > 0 && item.isAvailable ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:mt-3">
            {sizes.map((s) => {
              const isOn = selectedSize === s.sizeCode;
              const _sFinal = applyDiscount(s.price, item.discountPercentage);
              return (
                <button
                  key={s.sizeCode}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSize(isOn ? null : s.sizeCode);
                  }}
                  aria-pressed={isOn}
                  title={`${s.sizeCode} — ${formattedSizePrices.get(s.sizeCode)}`}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-[10px] font-black transition-all active:scale-95 sm:min-w-9 sm:px-2 sm:text-[11px]",
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
              <span className="ms-0.5 text-[10px] text-cream/50 sm:ms-1">
                {locale === "ar" ? "اختر المقاس" : "Pick a size"}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto pt-2.5 sm:pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-cream/65 sm:flex">
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
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd({ sizeCode: selectedSize ?? undefined, price: finalPrice });
                }}
                aria-label={locale === "ar" ? "إضافة إلى السلة" : "Add to cart"}
                className={cn(
                  "ms-auto flex h-10 items-center justify-center gap-1.5 rounded-full border font-black transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9",
                  qtyInCart > 0
                    ? "border-gold/60 bg-gold/15 px-3.5 text-gold"
                    : "border-gold/30 bg-gold/10 px-3 text-cream hover:bg-gold/20 hover:text-gold",
                )}
              >
                <Plus className="h-4 w-4" />
                {qtyInCart > 0 ? (
                  <span className="text-xs">{qtyInCart}</span>
                ) : (
                  <span className="hidden text-xs sm:inline">
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
    </article>
  );
}