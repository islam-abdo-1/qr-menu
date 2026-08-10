"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ScanLine, ShoppingBag, Sparkles, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { applyDiscount } from "@/lib/utils";
import type { MenuData } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ItemCard } from "@/components/public/item-card";
import { CartDrawer } from "@/components/public/cart-drawer";
import { ShareMenu } from "@/components/public/share-menu";
import { loadCart, saveCart, cartCount, cartTotal, cartKey, type CartItem } from "@/lib/cart";

type Props = {
  dict: Dictionary;
  data: MenuData;
  locale: "ar" | "en";
  slug?: string;
  /** رابط المنيو المطلق — لمشاركة المنيو */
  menuUrl: string;
};

/** فاصل زخرفي: خط — معيّن — خط */
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

export function MenuView({ dict, data, locale, slug, menuUrl }: Props) {
  const categories = data.categories;
  const bestSellers = data.bestSellers;
  const restaurantName =
    data.settings?.restaurantName || (locale === "ar" ? "قائمة الطعام" : "Menu");
  const currency = data.settings?.currency ?? "EGP";
  const themePrimary = data.settings?.themePrimary || "#C84C21";

  /* ───── السلة ───── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (slug) setCart(loadCart(slug));
  }, [slug]);

  useEffect(() => {
    if (slug) saveCart(slug, cart);
  }, [slug, cart]);

  // عدّاد فتحات المنيو (QR visits) — مرة واحدة لكل زيارة، خارج كاش ISR
  useEffect(() => {
    if (!slug) return;
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {
      // العدّاد غير حرج — لا نعطل تجربة العميل أبدًا
    });
  }, [slug]);

  const addToCart = useCallback(
    (
      item: { id: string; name: string; price: number; imageUrl: string | null },
      selected?: { sizeCode?: string; price: number },
    ) => {
      const sizeCode = selected?.sizeCode ?? undefined;
      const unitPrice = selected?.price ?? item.price;
      setCart((prev) => {
        const key = cartKey({ itemId: item.id, sizeCode });
        const existing = prev.find((i) => cartKey(i) === key);
        if (existing) {
          return prev.map((i) =>
            cartKey(i) === key ? { ...i, qty: Math.min(i.qty + 1, 50) } : i,
          );
        }
        return [
          ...prev,
          {
            itemId: item.id,
            name: item.name,
            price: unitPrice,
            imageUrl: item.imageUrl,
            sizeCode,
            qty: 1,
          },
        ];
      });
    },
    [],
  );

  const updateQty = useCallback(
    (itemId: string, sizeCode: string | null | undefined, qty: number) => {
      const key = cartKey({ itemId, sizeCode });
      setCart((prev) =>
        qty <= 0
          ? prev.filter((i) => cartKey(i) !== key)
          : prev.map((i) => (cartKey(i) === key ? { ...i, qty: Math.min(qty, 50) } : i)),
      );
    },
    [],
  );

  const removeFromCart = useCallback(
    (itemId: string, sizeCode: string | null | undefined) => {
      const key = cartKey({ itemId, sizeCode });
      setCart((prev) => prev.filter((i) => cartKey(i) !== key));
    },
    [],
  );

  const handleOrderPlaced = useCallback(() => {
    setCart([]);
  }, []);

  const cartQtyOf = useCallback(
    (itemId: string) => cart.find((i) => i.itemId === itemId)?.qty ?? 0,
    [cart],
  );

  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryKey = categories.map((c) => c.id).join("|");
  const logoUrl = data.settings?.logoUrl ?? "/logo-gold.png";

  useEffect(() => {
    if (categories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const catId = (visible[0].target as HTMLElement).dataset.catId;
          if (catId) setActive(catId);
        }
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0, 0.2, 0.5, 1] },
    );
    categories.forEach((c) => {
      const el = sectionRefs.current[c.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categoryKey, categories]);

  const jump = useCallback(
    (id: string) => {
      setActive(id);
      const el = sectionRefs.current[id];
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    },
    [],
  );

  const scrollToMenu = useCallback(() => {
    if (categories[0]) jump(categories[0].id);
  }, [categories, jump]);

  return (
    <main className="min-h-screen bg-background pb-0">
      {/* ───── Hero داكن فاخر ───── */}
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

      {categories.length === 0 ? (
        <section className="texture-dots container flex flex-col items-center gap-5 py-28 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-gold/30 bg-gold/10 text-gold">
            <ScanLine className="h-10 w-10" />
          </div>
          <p className="text-lg font-bold">{dict.menu.empty}</p>
        </section>
      ) : (
        <>
          {/* ───── شريط الأقسام العائم الداكن ───── */}
          <nav className="sticky top-3 z-40 px-3 sm:top-5">
            <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-2xl border border-gold/20 bg-[#191310]/90 py-2 ps-4 pe-2 shadow-elevated backdrop-blur-xl">
              <span className="hidden shrink-0 items-center gap-2 text-sm font-black text-cream md:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-[#a87a2b] text-background">
                  <UtensilsCrossed className="h-4 w-4" />
                </span>
                <span className="max-w-32 truncate">{restaurantName}</span>
              </span>
              <div className="scrollbar-hide flex flex-1 items-center gap-1.5 overflow-x-auto py-1">
                {categories.map((c) => {
                  const isActive = active === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => jump(c.id)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition-all active:scale-95",
                        isActive
                          ? "text-background shadow-md"
                          : "text-cream/75 hover:bg-gold/10 hover:text-gold",
                      )}
                      style={
                        isActive
                          ? {
                              background: "linear-gradient(135deg, #d4a853, #a87a2b)",
                              boxShadow: "0 6px 18px -6px rgba(212,168,83,0.5)",
                            }
                          : undefined
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <ShareMenu menuUrl={menuUrl} shareText={locale === "ar" ? "تفضل قائمة الطعام" : "Check out the menu"} />
            </div>
          </nav>

          {/* ───── الأقسام والعناصر ───── */}
          <div className="container mt-14 max-w-5xl space-y-16 pb-4">
            {categories.map((category, index) => (
              <section
                key={category.id}
                ref={(el) => {
                  sectionRefs.current[category.id] = el;
                }}
                data-cat-id={category.id}
                className="scroll-mt-32"
              >
                <motion.div
                  className="mb-8 text-center"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5 }}
                >
                  <h2 className="font-display text-4xl font-bold text-gold-gradient drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-5xl">
                    {category.name}
                  </h2>
                  <Ornament className="mt-4 text-gold" />
                </motion.div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item, itemIndex) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      currency={currency}
                      locale={locale}
                      index={itemIndex}
                      delay={index * 0.02}
                      themePrimary={themePrimary}
                      qtyInCart={cartQtyOf(item.id)}
                      bestSeller={bestSellers.includes(item.id)}
                      onAdd={(sel) =>
                        addToCart(
                          { id: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl },
                          {
                            sizeCode: sel?.sizeCode,
                            price: sel?.price ?? applyDiscount(item.price, item.discountPercentage),
                          },
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* ───── درج السلة ───── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        slug={slug ?? ""}
        locale={locale}
        currency={currency}
        tables={data.tables}
        items={cart}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* ───── شريط السلة العائم ───── */}
      {slug && cart.length > 0 ? (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-5 z-40 px-4"
        >
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-[#191310]/95 px-5 py-3.5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-[#a87a2b] text-background">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3ECF7A] px-1 text-[10px] font-black text-background ring-2 ring-[#191310]">
                  {cartCount(cart)}
                </span>
              </span>
              <span className="text-sm font-black text-cream">
                {locale === "ar" ? "عرض السلة" : "View cart"}
              </span>
            </span>
            <span className="text-sm font-black text-gold">
              {formatPrice(cartTotal(cart), currency, locale)}
            </span>
          </button>
        </motion.div>
      ) : null}

      {/* ───── الفوتر ───── */}
      <footer className="mt-24 overflow-hidden">
        <div className="relative border-t border-gold/20 bg-[#0D0A08] py-14 text-center text-cream">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #d4a853, transparent)" }}
            aria-hidden
          />
          <div className="container flex flex-col items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gold/70 bg-[#0D0A08] shadow-[0_0_30px_-6px_rgba(212,168,83,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
            </div>
            <p className="font-display text-3xl font-bold text-gold-gradient">
              {restaurantName}
            </p>
            <Ornament className="text-gold" />
            <p className="flex items-center gap-2 text-sm text-cream/70">
              <ScanLine className="h-4 w-4 text-gold" />
              {dict.footer}
            </p>
            <p className="text-xs text-cream/60">
              © {new Date().getFullYear()} {restaurantName}
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}