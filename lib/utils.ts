import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** تنسيق السعر حسب العملة */
export function formatPrice(amount: number, currency: string, locale = "ar-EG") {
  const symbols: Record<string, string> = {
    EGP: "ج.م",
    USD: "$",
    SAR: "ر.س",
    AED: "د.إ",
  };
  const suffix = symbols[currency] ?? currency;
  const value = amount.toLocaleString(locale === "en" ? "en-US" : "ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return suffix ? `${value} ${suffix}` : value;
}

/** توليد رابط عام لصورة مخزن Supabase من مسارها */
export function publicImageUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
}

/**
 * تطبيق خصم نسبة على سعر — نقطة الحساب الوحيدة في النظام:
 * finalPrice = base - (base * discountPercentage / 100)
 * التقريب لأقرب قرش يمنع أخطاء الفاصلة العائمة.
 */
export function applyDiscount(price: number, discountPercentage: number | null | undefined) {
  const pct = discountPercentage == null ? 0 : Math.max(0, Math.min(100, discountPercentage));
  if (pct <= 0) return price;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}