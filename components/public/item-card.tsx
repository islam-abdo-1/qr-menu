"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { UtensilsCrossed } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { MenuCategory } from "@/lib/data";

type Props = {
  item: MenuCategory["items"][number];
  currency: string;
  locale: "ar" | "en";
  index?: number;
  delay?: number;
  themePrimary?: string;
};

export function ItemCard({ item, currency, locale, index = 0, delay = 0, themePrimary }: Props) {
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
        {/* شارة السعر */}
        <span
          className="absolute bottom-3 rounded-full bg-gradient-to-l from-gold to-[#a87a2b] px-3.5 py-1 text-xs font-black text-background shadow-md"
          style={{ insetInlineStart: "0.75rem" }}
        >
          {formatPrice(item.price, currency, locale)}
        </span>
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
        <h3 className="font-display text-xl font-bold leading-snug text-cream">
          {item.name}
        </h3>
        {item.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-cream/80 sm:text-[13px]">
            {item.description}
          </p>
        ) : null}

        <div className="mt-auto pt-3">
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