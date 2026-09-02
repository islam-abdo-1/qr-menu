"use client";

import { motion } from "framer-motion";
import { Sparkles, UtensilsCrossed, ChevronDown, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { MenuData } from "@/lib/data";

type Props = {
  dict: Dictionary;
  data: MenuData;
  locale: "ar" | "en";
  _slug: string;
  _menuUrl: string;
};

function Ornament({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3", className)} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-l from-gold/80 to-transparent" />
      <svg width="14" height="14" viewBox="0 0 14 14" className="rotate-45 text-gold">
        <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
      </svg>
      <span className="h-px w-16 bg-gradient-to-r from-gold/80 to-transparent" />
    </div>
  );
}

export function MenuHero({ dict, data, locale, _slug, _menuUrl }: Props) {
  const restaurantName =
    data.settings?.restaurantName || (locale === "ar" ? "قائمة الطعام" : "Menu");
  const themePrimary = data.settings?.themePrimary || "#C84C21";
  const logoUrl = data.settings?.logoUrl ?? null;

  const scrollToMenu = () => {
    const el = document.getElementById("menu-sections");
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <header className="texture-dots relative overflow-hidden text-cream">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1100px 500px at 50% -10%, rgba(212,168,83,0.22), transparent 60%), radial-gradient(800px 420px at 85% 110%, ${themePrimary}26, transparent 55%), linear-gradient(180deg, #14100D 0%, #1B1510 100%)`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -end-24 -top-24 hidden h-72 w-72 animate-float rounded-full bg-gold/15 blur-3xl sm:block" aria-hidden />
      <div className="pointer-events-none absolute -start-24 bottom-0 hidden h-72 w-72 rounded-full bg-primary/15 blur-3xl sm:block" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" aria-hidden />

      <div className="container relative flex min-h-[78vh] flex-col items-center justify-center gap-6 py-20 text-center sm:min-h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-xs font-bold tracking-wide text-gold backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {dict.hero.welcome}
        </motion.div>

        {logoUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative"
          >
            <div className="pointer-events-none absolute inset-0 -m-3 rounded-full bg-gold/25 blur-2xl" aria-hidden />
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-gold/80 bg-[#14100D] shadow-[0_0_50px_-6px_rgba(212,168,83,0.5)] ring-1 ring-black/40 sm:h-32 sm:w-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
            </div>
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-6xl font-bold text-gold-gradient drop-shadow-[0_4px_24px_rgba(212,168,83,0.25)] sm:text-7xl md:text-8xl"
        >
          {restaurantName}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="max-w-md text-sm leading-relaxed text-cream/80 sm:text-base"
        >
          {dict.hero.tagline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex flex-col items-center gap-4"
        >
          <button
            type="button"
            onClick={scrollToMenu}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-l from-gold to-[#a87a2b] px-8 py-3.5 text-sm font-black text-background shadow-[0_12px_40px_-8px_rgba(212,168,83,0.5)] transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95"
          >
            <UtensilsCrossed className="h-4 w-4" />
            {dict.hero.explore}
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </button>
          <p className="flex items-center gap-1.5 text-xs text-cream/70">
            <ScanLine className="h-3.5 w-3.5 text-gold" />
            {dict.hero.scanHint}
          </p>
        </motion.div>

        <Ornament className="mt-2 text-gold" />
      </div>
    </header>
  );
}