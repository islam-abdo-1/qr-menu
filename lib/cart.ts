"use client";

export type CartItem = {
  itemId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  qty: number;
};

const keyFor = (slug: string) => `qr-cart-${slug}`;

export function loadCart(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.itemId && i.qty > 0) : [];
  } catch {
    return [];
  }
}

export function saveCart(slug: string, items: CartItem[]) {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(items));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

export function cartCount(items: CartItem[]) {
  return items.reduce((n, i) => n + i.qty, 0);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}
