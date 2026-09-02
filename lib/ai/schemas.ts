import { z } from "zod";

/**
 * مخططات مخرجات الـ AI — عقد صارم على ما يدخل قاعدة البيانات،
 * متسامح مع تقلّب مخرجات الموديل (sanitize أولاً ثم Zod).
 * القاعدة الذهبية (بند 14): غير الواضح → null + needs_review.
 */

/* ─────────────── أنواع القسم المسموحة ─────────────── */

export const CATEGORY_TYPES = [
  "grilled_food", "burgers", "pizza", "pasta", "seafood", "breakfast",
  "desserts", "hot_drinks", "cold_drinks", "coffee", "juices",
  "main_dishes", "appetizers", "salads", "sandwiches", "other",
] as const;

export type CategoryType = (typeof CATEGORY_TYPES)[number];

/* ─────────────── أدوات التطبيع (قبل Zod) ─────────────── */

/** الثقة: تقبل 0-1 أو 0-100 أو نص — ترجع 0-1 أو null */
function normalizeConfidence(v: unknown): number | null {
  const n =
    typeof v === "string" ? Number.parseFloat(v) :
    typeof v === "number" ? v :
    NaN;
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return Math.min(1, n / 100);
  if (n >= 0 && n <= 1) return n;
  return null;
}

/** نص آمن: قصّ بدل رفض */
function sanitizeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length > 0 ? s : null;
}

/** سعر آمن: يقبل نص "75 ج.م" — ≤ 0 أو غير رقمي → null (لا تخمين) */
function sanitizePrice(v: unknown): number | null {
  let n: number;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.]/g, "");
    n = Number.parseFloat(cleaned);
  } else if (typeof v === "number") {
    n = v;
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

/** عدد صحيح آمن مع حد أدنى */
function sanitizeInt(v: unknown, min: number): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.round(n));
}

/** نوع قسم: مطابقة مرنة (جزء من الاسم) وإلا null — يُراجَع يدوياً */
function sanitizeCategoryType(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s.length === 0) return null;
  // مطابقة مباشرة
  const direct = CATEGORY_TYPES.find((c) => c === s);
  if (direct) return direct;
  // مطابقة جزئية (مثل "soups" تحتوي "salads"? لا — نجرب الاتجاهين)
  const partial = CATEGORY_TYPES.find(
    (c) => s.includes(c) || c.includes(s.replace(/s$/, "")),
  );
  if (partial) return partial;
  // غير معروف → null (قابل للتعديل في المراجعة — لا رفض)
  return null;
}

/**
 * تطبيع شامل لمخرجات الـ AI الخام قبل Zod — يحوّل التقلبات إلى شكل صالح.
 * يتعامل مع unknown بدفاع كامل — لا يرمي أبداً.
 */
export function sanitizeAiMenu(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const root = raw as Record<string, unknown>;

  // restaurant
  let restaurant: unknown = null;
  if (typeof root.restaurant === "object" && root.restaurant !== null) {
    const r = root.restaurant as Record<string, unknown>;
    restaurant = {
      name: sanitizeText(r.name, 80),
      currency: sanitizeText(r.currency, 3)?.toUpperCase() ?? null,
    };
  }

  // categories
  const rawCats = Array.isArray(root.categories) ? root.categories : [];
  const categories = rawCats.slice(0, 30).map((rc, catIdx) => {
    const c = (typeof rc === "object" && rc !== null ? rc : {}) as Record<string, unknown>;

    const rawItems = Array.isArray(c.items) ? c.items : [];
    const items = rawItems.slice(0, 200).map((ri) => {
      const it = (typeof ri === "object" && ri !== null ? ri : {}) as Record<string, unknown>;

      // variants
      const rawVariants = Array.isArray(it.variants) ? it.variants : [];
      const variants = rawVariants
        .slice(0, 8)
        .map((rv) => {
          const v = (typeof rv === "object" && rv !== null ? rv : {}) as Record<string, unknown>;
          const vName = sanitizeText(v.name, 24);
          const vPrice = sanitizePrice(v.price);
          return vName ? { name: vName, price: vPrice } : null;
        })
        .filter((v) => v !== null);

      // image
      let image: unknown = null;
      if (
        typeof it.image === "object" && it.image !== null &&
        (it.image as Record<string, unknown>).detected === true
      ) {
        const img = it.image as Record<string, unknown>;
        let region: unknown = null;
        if (typeof img.region === "object" && img.region !== null) {
          const rg = img.region as Record<string, unknown>;
          const num = (x: unknown) => {
            const n = typeof x === "number" ? x : NaN;
            return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
          };
          region = {
            x: num(rg.x), y: num(rg.y), w: num(rg.w), h: num(rg.h),
          };
        }
        image = {
          detected: true,
          confidence: normalizeConfidence(img.confidence),
          region,
        };
      }

      return {
        name: sanitizeText(it.name, 120) ?? "صنف غير مقروء",
        description: sanitizeText(it.description, 400),
        price: sanitizePrice(it.price),
        variants: variants.length > 0 ? variants : null,
        image,
        sourcePage: it.sourcePage != null ? sanitizeInt(it.sourcePage, 1) : null,
        imagePage: it.imagePage != null ? sanitizeInt(it.imagePage, 1) : null,
        imageConfidence: it.imageConfidence != null ? normalizeConfidence(it.imageConfidence) : null,
        imageRegion: typeof it.imageRegion === "object" && it.imageRegion !== null ? it.imageRegion : null,
        confidence: normalizeConfidence(it.confidence),
      };
    });

    if (items.length === 0) return null; // قسم فارغ → تجاهل

    return {
      name: sanitizeText(c.name, 60) ?? `قسم ${catIdx + 1}`,
      description: sanitizeText(c.description, 300),
      order: sanitizeInt(c.order, catIdx + 1),
      categoryType: sanitizeCategoryType(c.categoryType),
      categoryConfidence: normalizeConfidence(c.categoryConfidence),
      items,
    };
  }).filter((c) => c !== null);

  return { restaurant, categories };
}

/* ─────────────── مخططات Zod (على البيانات المُطبَّعة) ─────────────── */

/** مقاس/متغير بصنف — يطابق نظام MenuItemSize الموجود */
export const aiVariantSchema = z.object({
  name: z.string().trim().min(1).max(24),
  price: z.number().positive().max(1_000_000).nullable(),
});

/** صنف مستخرج من المنيو */
export const aiItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable(),
  price: z.number().positive().max(1_000_000).nullable(),
  variants: z.array(aiVariantSchema).max(8).nullable(),
  image: z
    .object({
      detected: z.boolean(),
      confidence: z.number().min(0).max(1).nullable(),
      region: z
        .object({
          x: z.number().min(0).max(1),
          y: z.number().min(0).max(1),
          w: z.number().min(0).max(1),
          h: z.number().min(0).max(1),
        })
        .nullable(),
    })
    .nullable(),
  sourcePage: z.number().int().min(1).max(200).nullable(),
  imagePage: z.number().int().min(1).max(200).nullable(),
  imageConfidence: z.number().min(0).max(1).nullable(),
  imageRegion: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().min(0).max(1),
      h: z.number().min(0).max(1),
    })
    .nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  needsReview: z.boolean().optional(),
  reviewReasons: z.array(z.string()).optional(),
});

/** قسم مستخرج */
export const aiCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullable(),
  order: z.number().int().min(1).max(999),
  categoryType: z.string().nullable(), // مطبَّع مسبقاً — قد يكون null (يُراجَع)
  categoryConfidence: z.number().min(0).max(1).nullable(),
  items: z.array(aiItemSchema).min(1).max(200),
});

/** المنيو المستخرج كاملاً */
export const aiMenuSchema = z.object({
  restaurant: z
    .object({
      name: z.string().trim().max(80).nullable(),
      currency: z.string().trim().length(3).nullable(),
    })
    .nullable(),
  categories: z.array(aiCategorySchema).min(1).max(30),
});

export type AiMenuOutput = z.infer<typeof aiMenuSchema>;
export type AiCategoryOutput = z.infer<typeof aiCategorySchema>;
export type AiItemOutput = z.infer<typeof aiItemSchema>;
export type AiVariantOutput = z.infer<typeof aiVariantSchema>;

/** تعليم الأصناف التي تحتاج مراجعة (أسعار ناقصة/ثقة منخفضة) */
export function markNeedsReview(
  menu: AiMenuOutput,
  imageThreshold: number,
): AiMenuOutput {
  for (const cat of menu.categories) {
    for (const item of cat.items) {
      const reasons: string[] = [];
      if (item.price === null && (!item.variants || item.variants.length === 0)) {
        reasons.push("price_unclear");
      }
      if (item.confidence !== null && item.confidence < 0.7) {
        reasons.push("low_confidence");
      }
      if (cat.categoryType === null) reasons.push("category_uncertain");
      if (item.image?.detected && (item.image.confidence ?? 0) < imageThreshold) {
        reasons.push("image_low_confidence");
      }
      item.needsReview = reasons.length > 0;
      if (reasons.length > 0) item.reviewReasons = reasons;
    }
  }
  return menu;
}
