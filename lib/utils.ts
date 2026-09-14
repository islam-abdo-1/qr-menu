import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** تنسيق السعر حسب العملة */
export function formatPrice(amount: number, currency: string, locale = "ar-EG") {
  const symbols: Record<string, string> = {
    EGP: "ج.م",
    SAR: "ر.س",
    AED: "د.إ",
    KWD: "د.ك",
    QAR: "ر.ق",
    BHD: "د.ب",
    OMR: "ر.ع",
    JOD: "د.أ",
    IQD: "د.ع",
    LBP: "ل.ل",
    SYP: "ل.س",
    LYD: "د.ل",
    TND: "د.ت",
    DZD: "د.ج",
    MAD: "د.م",
    SDG: "ج.س",
    YER: "ر.ي",
    SOS: "ش.ص",
    DJF: "ف.ج",
    KMF: "ف.ق",
    MRU: "أ.م",
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
 * تحويل رابط Supabase Storage إلى رابط Image Proxy للتخزين المؤقت والتحسين
 * يستخدم لتحويل روابط Supabase Storage إلى Image Proxy للتخزين المؤقت والتحسين
 */
export function toImageProxyUrl(url: string | null | undefined, options?: { width?: number; height?: number; quality?: number; format?: 'webp' | 'jpeg' | 'png' | 'avif' }): string | undefined {
  if (!url) return undefined;
  // إذا كان الرابط بالفعل proxied أو ليس من Supabase، أرجعه كما هو
  if (url.startsWith('/api/image') || !url.includes('supabase')) return url;
  
  const params = new URLSearchParams();
  params.set('url', url);
  if (options?.width) params.set('w', String(options.width));
  if (options?.height) params.set('h', String(options.height));
  if (options?.quality) params.set('q', String(options.quality));
  if (options?.format) params.set('f', options.format);
  
  return `/api/image?${params.toString()}`;
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

/**
 * التحقق من صحة رقم الهاتف لطلبات التوصيل:
 * - جوال مصري محلي: 11 رقمًا يبدأ بـ 01 (010/011/012/015...)
 * - دولي عام: يبدأ بـ + ثم 7-15 رقمًا (E.164) — للسياح والأجانب
 * يقبل الكتابة بالمسافات/الشرطات أو برمز الدولة المصري (+20 / 0020).
 */
export function isValidPhone(raw: string): boolean {
  const p = raw.replace(/[\s-]/g, "");
  if (!p) return false;
  // تحويل رمز الدولة المصري إلى الشكل المحلي: +20... → 0...
  const local = p.replace(/^(?:\+?20|0020)/, "0");
  if (/^01\d{9}$/.test(local)) return true;
  if (/^\+\d{7,15}$/.test(p)) return true;
  return false;
}