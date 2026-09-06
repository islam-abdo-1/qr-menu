"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { motion } from "framer-motion";
import { ScanLine, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { applyDiscount } from "@/lib/utils";
import { toImageProxyUrl } from "@/lib/utils";
import type { MenuCategory, MenuData } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ItemCard } from "@/components/public/item-card";
import { ShareMenu } from "@/components/public/share-menu";
import { loadCart, saveCart, cartCount, cartTotal, cartKey, type CartItem } from "@/lib/cart";

const ItemDetailDialog = dynamic(
  () => import("@/components/public/item-detail-dialog").then((mod) => mod.ItemDetailDialog),
  { ssr: false, loading: () => null }
);

const CartDrawer = dynamic(
  () => import("@/components/public/cart-drawer").then((mod) => mod.CartDrawer),
  { ssr: false, loading: () => null }
);

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

type Props = {
  dict: Dictionary;
  data: MenuData;
  locale: "ar" | "en";
  slug?: string;
  menuUrl: string;
};

export function MenuSections({ dict, data, locale, slug, menuUrl }: Props) {
  const categories = data.categories;
  const bestSellers = data.bestSellers;
  const restaurantName =
    data.settings?.restaurantName || (locale === "ar" ? "قائمة الطعام" : "Menu");
  const currency = data.settings?.currency ?? "EGP";
  const themePrimary = data.settings?.themePrimary || "#C84C21";
  const deliveryEnabled = data.settings?.deliveryEnabled ?? true;
  const logoUrl = data.settings?.logoUrl ?? null;

  /* ───── السلة ───── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (slug) setCart(loadCart(slug));
  }, [slug]);

  useEffect(() => {
    if (slug) saveCart(slug, cart);
  }, [slug, cart]);

  // QR visits counter
  useEffect(() => {
    if (!slug) return;
    try {
      const cairoDay = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const key = `qr-visit-${slug}-${cairoDay}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, marker: `qr-v1-${Math.random().toString(36).slice(2)}` }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
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

  // Memoized quantity lookup - O(1) instead of O(n) per call
  const cartQtyMap = useMemo(
    () => new Map(cart.map((i) => [i.itemId, i.qty])),
    [cart]
  );
  const cartQtyOf = useCallback(
    (itemId: string) => cartQtyMap.get(itemId) ?? 0,
    [cartQtyMap]
  );

  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryKey = categories.map((c) => c.id).join("|");

  /* ───── نافذة تفاصيل المنتج ───── */
  const [detailItem, setDetailItem] = useState<MenuCategory["items"][number] | null>(null);
  useEffect(() => {
    if (detailItem && !categories.some((c) => c.items.some((i) => i.id === detailItem.id))) {
      setDetailItem(null);
    }
  }, [categoryKey, detailItem]);

  // Active section observer
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

  // Animation observer for CSS animations
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".animate-fade-in-up:not(.animate-visible)");
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "-40px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categoryKey]);

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

  if (categories.length === 0) {
    return (
      <section className="texture-dots container flex flex-col items-center gap-5 py-28 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-gold/30 bg-gold/10 text-gold">
          <ScanLine className="h-10 w-10" />
        </div>
        <p className="text-lg font-bold">{dict.menu.empty}</p>
      </section>
    );
  }

  return (
    <>
      {/* ───── شريط الأقسام العائم الداكن ───── */}
      <nav className="sticky top-3 z-40 px-3 sm:top-5">
        <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-2xl border border-gold/20 bg-[#191310]/90 py-2 ps-4 pe-2 shadow-elevated backdrop-blur-xl">
          <span className="hidden shrink-0 items-center gap-2 text-sm font-black text-cream md:flex">
            {logoUrl ? (
              <Image
                src={toImageProxyUrl(logoUrl, { width: 28, height: 28, quality: 80 }) || logoUrl}
                alt={restaurantName}
                width={28}
                height={28}
                className="h-7 w-7 rounded-lg object-cover ring-1 ring-gold/40"
                unoptimized
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-[#a87a2b] text-background">
                <UtensilsCrossed className="h-4 w-4" />
              </span>
            )}
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
      <div id="menu-sections" className="container mt-14 max-w-5xl space-y-16 pb-4">
        {categories.map((category) => (
          <section
            key={category.id}
            ref={(el) => {
              sectionRefs.current[category.id] = el;
            }}
            data-cat-id={category.id}
            className="menu-section scroll-mt-32"
          >
            <div
              className="mb-8 text-center animate-fade-in-up"
            >
              <h2 className="font-display text-4xl font-bold text-gold-gradient drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-5xl">
                {category.name}
              </h2>
              <Ornament className="mt-4 text-gold" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {category.items.map((item, itemIndex) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  locale={locale}
                  index={itemIndex}
                  themePrimary={themePrimary}
                  logoUrl={logoUrl}
                  qtyInCart={cartQtyOf(item.id)}
                  bestSeller={bestSellers.includes(item.id)}
                  onOpenDetails={() => setDetailItem(item)}
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

      {/* ───── نافذة تفاصيل المنتج ───── */}
      <ItemDetailDialog
        key={detailItem?.id ?? "closed"}
        item={detailItem}
        currency={currency}
        locale={locale}
        themePrimary={themePrimary}
        logoUrl={logoUrl}
        qtyInCart={detailItem ? cartQtyOf(detailItem.id) : 0}
        onAdd={(sel) =>
          detailItem
            ? addToCart(
                { id: detailItem.id, name: detailItem.name, price: detailItem.price, imageUrl: detailItem.imageUrl },
                {
                  sizeCode: sel?.sizeCode,
                  price: sel?.price ?? applyDiscount(detailItem.price, detailItem.discountPercentage),
                },
              )
            : undefined
        }
        onClose={() => setDetailItem(null)}
      />

      {/* ───── درج السلة ───── */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        slug={slug ?? ""}
        locale={locale}
        currency={currency}
        tables={data.tables}
        items={cart}
        deliveryEnabled={deliveryEnabled}
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
            className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-[#191310]/95 px-5 py-3.5 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)] transition-transform active:scale-[0.98]"
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
            {logoUrl ? (
              <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-gold/70 bg-[#0D0A08] shadow-[0_0_30px_-6px_rgba(212,168,83,0.5)]">
                <Image 
                  src={toImageProxyUrl(logoUrl, { width: 64, height: 64, quality: 80 }) || logoUrl} 
                  alt={restaurantName} 
                  fill 
                  className="object-cover" 
                  sizes="64px"
                  unoptimized
                />
              </div>
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                <UtensilsCrossed className="h-6 w-6" />
              </span>
            )}
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
    </>
  );
}