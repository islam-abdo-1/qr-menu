import "server-only";
import { createHmac, createPublicKey, timingSafeEqual, verify as cryptoVerify } from "crypto";
import { unstable_cache as cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { decodeJwtPayload, sessionCookieValue, tokenFromSessionCookie } from "@/lib/session";
import { getBillingEnabled, getBillingInfo, trialDaysLeft } from "@/lib/billing";

/** المفتاح العام المستخدم لتوقيع التوكنات (الصيغة الجديدة لـ Supabase: ES256/JWK) */
let cachedPublicKey: ReturnType<typeof createPublicKey> | null | undefined;
function getJwtPublicKey() {
  if (cachedPublicKey !== undefined) return cachedPublicKey;
  cachedPublicKey = null;
  try {
    const raw = process.env.SUPABASE_JWT_PUBLIC_KEY;
    if (!raw) return null;
    const jwks = JSON.parse(raw) as unknown;
    const jwksObj = jwks as { keys?: Array<Record<string, string>> };
    const keys = Array.isArray(jwksObj.keys) ? jwksObj.keys : [jwks as Record<string, string>];
    const jwk = keys.find((k) => k && k.kty === "EC");
    if (!jwk) return null;
    cachedPublicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch {
    cachedPublicKey = null;
  }
  return cachedPublicKey;
}

/** تحويل توقيع ECDSA (R||S خام) إلى DER — Node يطلب DER */
function rawEcdsaToDer(raw: Buffer): Buffer {
  const r = BigInt(`0x${raw.subarray(0, 32).toString("hex")}`);
  const s = BigInt(`0x${raw.subarray(32, 64).toString("hex")}`);
  const intBytes = (n: bigint): Buffer => {
    let hex = n.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    if (/^[89a-f]/i.test(hex)) hex = `00${hex}`;
    return Buffer.from(hex, "hex");
  };
  const rb = intBytes(r);
  const sb = intBytes(s);
  const inner = Buffer.concat([
    Buffer.from([0x02, rb.length]), rb,
    Buffer.from([0x02, sb.length]), sb,
  ]);
  return Buffer.concat([Buffer.from([0x30, inner.length]), inner]);
}

/**
 * تحقق التوقيع من JWT — لا نثق بأي توكن غير موقّع:
 *  1) ES256 عبر المفتاح العام JWK (الصيغة الجديدة لـ Supabase).
 *  2) HMAC-SHA256 (الصيغة الكلاسيكية عبر SUPABASE_JWT_SECRET).
 * أي فشل = رفض، وعندها يسقط المسار إلى getUser() الموثّق.
 */
function verifyJwtSignature(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const unsigned = Buffer.from(`${parts[0]}.${parts[1]}`);
  try {
    const pub = getJwtPublicKey();
    if (pub) {
      const sig = Buffer.from(parts[2], "base64url");
      if (cryptoVerify("sha256", unsigned, pub, sig)) return true;
      if (sig.length === 64) return cryptoVerify("sha256", unsigned, pub, rawEcdsaToDer(sig));
      return false;
    }
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) return false;
    const expected = createHmac("sha256", secret).update(unsigned).digest("base64url");
    const a = Buffer.from(parts[2]);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** العلامة المستخدمة لكل تجديد بعد التعديل من لوحة الإدارة */
export const MENU_TAG = "menu";

/** علامة بيانات المالك المخزّنة — تُمسح عند تغيير إعدادات الموظفين */
export const OWNER_TAG = "owner";

export type MenuTable = {
  number: number;
  reserved: boolean;
};

export type MenuItemSize = {
  sizeCode: string;
  price: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    discountPercentage: number | null;
    sizeMode: "letters" | "weight";
    sizes: MenuItemSize[];
    imageUrl: string | null;
    imageBlurDataURL: string | null;
    isAvailable: boolean;
  }[];
};

export type MenuData = {
  settings: {
    restaurantName: string;
    currency: string;
    themePrimary: string;
    logoUrl: string | null;
    deliveryEnabled: boolean;
  } | null;
  categories: MenuCategory[];
  bestSellers: string[];
  tables: MenuTable[];
};

async function loadRestaurant(restaurantId: string): Promise<MenuData> {
  try {
    const [settings, categories, bestSellers, tables] = await Promise.all([
      prisma.setting.findUnique({ where: { restaurantId } }),
      prisma.category.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              discountPercentage: true,
              sizeMode: true,
              sizes: { select: { sizeCode: true, price: true } },
              imageUrl: true,
              imageBlurDataURL: true,
              isAvailable: true,
            },
          },
        },
      }),
      getBestSellers(restaurantId),
      prisma.table.findMany({
        where: { restaurantId },
        orderBy: { number: "asc" },
        select: { number: true, reserved: true },
      }),
    ]);

    // في القائمة العامة نعرض فقط العناصر المتاحة
    const visible = categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        items: c.items
          .filter((i) => i.isAvailable)
          .map((i) => ({
            ...i,
            imageBlurDataURL: i.imageBlurDataURL ?? null,
            sizeMode: (i.sizeMode === "weight" ? "weight" : "letters") as "letters" | "weight",
          })),
      }))
      .filter((c) => c.items.length > 0);

    return {
      settings: settings
        ? {
            restaurantName: settings.restaurantName,
            currency: settings.currency,
            themePrimary: settings.themePrimary,
            logoUrl: settings.logoUrl || null,
            deliveryEnabled: settings.deliveryEnabled,
          }
        : null,
      categories: visible,
      bestSellers: bestSellers,
      tables: tables.map((t) => ({ number: t.number, reserved: t.reserved })),
    };
  } catch (e) {
    // لا نعيد منيو فارغًا عند تعذّر الاتصال — فإعادة البناء الفاشلة تُبقي آخر كاش صالح
    // لدى Vercel بدل تخزين صفحة فارغة في ISR (منيو فارغ يظهر للعملاء لاحقًا).
    console.error("[data] قاعدة البيانات غير متاحة:", e);
    throw e;
  }
}

/**
 * منيو مطعم — بدون slug: المطعم الرئيسي (الرابط الأساسي للموقع).
 * البيانات في كاش ISR لمدة 300 ثانية (تُحدَّث فورًا من لوحة الإدارة عبر revalidateTag).
 * Stale-while-revalidate يتم عبر PWA config (StaleWhileRevalidate handler للـ /m/*).
 */
export const getMenuData = cache(
  async (slug?: string): Promise<MenuData | null> => {
    const restaurant = slug
      ? await prisma.restaurant.findUnique({ where: { slug } })
      : await prisma.restaurant.findFirst({ orderBy: { createdAt: "asc" } });
    return restaurant ? loadRestaurant(restaurant.id) : null;
  },
  ["qr-menu"],
  { tags: [MENU_TAG], revalidate: 30 },
);

/**
 * Best Sellers — cached for 1 hour (changes infrequently).
 * Separate cache key to avoid invalidating full menu when best sellers update.
 */
export const getBestSellers = cache(
  async (restaurantId: string): Promise<string[]> => {
    const bestSellers = await prisma.$queryRaw<{ itemId: string }[]>`
      SELECT oi."itemId"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."restaurantId" = ${restaurantId} AND oi."itemId" IS NOT NULL
        AND o."createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}::timestamptz
      GROUP BY oi."itemId"
      ORDER BY SUM(oi."qty") DESC
      LIMIT 3
    `;
    return bestSellers.map((b) => b.itemId);
  },
  ["qr-menu-best-sellers"],
  { tags: [MENU_TAG], revalidate: 300 },
);

/** استعلام المطعم نفسه بكاش قصير — id و slug ثابتان، والتغييرات تُمسح عبر OWNER_TAG */
const cachedOwner = cache(
  async (ownerId: string) =>
    prisma.restaurant.findUnique({ where: { ownerId } }),
  ["qr-menu-owner"],
  { tags: [OWNER_TAG], revalidate: 20 },
);

/**
 * مستخدم Supabase من توكن الجلسة — تحقق محلي فقط (فك JWT + تحقق توقيع + انتهاء):
 * صفر شبكة على المسار السريع، وصفر استدعاءات getUser() إطلاقًا.
 * تجديد الجلسة (refresh) مسؤولية الـ middleware وحدها — أي استدعاء getUser() آخر
 * في نفس لحظة انتهاء التوكن كان يسبب سباق تدوير refresh token → كسر الجلسة
 * → «طلب تسجيل الدخول» المتكرر. عند انتهاء التوكن نعيد null بهدوء
 * (الإجراءات تتوقف، والـ layout/الـ middleware يعيدان التوجيه أو التجديد).
 */
async function resolveUserId(token: string): Promise<string | null> {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  const sub = payload?.sub;
  if (exp && exp > Date.now() && typeof sub === "string" && sub && verifyJwtSignature(token)) {
    return sub;
  }
  return null;
}

/** مطعم المالك الحالي من الجلسة — تُستخدم في لوحة الإدارة وكل إجراءات التعديل */
export async function getOwnerRestaurant() {
  const value = sessionCookieValue(cookies().getAll());
  const token = value ? tokenFromSessionCookie(value) : null;
  if (!token) return null;
  const userId = await resolveUserId(token);
  if (!userId) return null;
  return cachedOwner(userId);
}

/** بيانات لوحة الإدارة — مع كاش 30s + إبطال فوري عبر OWNER_TAG */
const getAdminDataCached = cache(
  async (restaurantId: string) => {
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) return null;

    const billingEnabled = await getBillingEnabled();
    const billing = getBillingInfo(restaurant, billingEnabled);

    const [settings, categories] = await Promise.all([
      prisma.setting.findUnique({ where: { restaurantId } }),
      prisma.category.findMany({
        where: { restaurantId },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              discountPercentage: true,
              sizeMode: true,
              sizes: { select: { sizeCode: true, price: true } },
              imageUrl: true,
              imageWidth: true,
              imageHeight: true,
              imageSizeKB: true,
              isAvailable: true,
            },
          },
        },
      }),
    ]);

    return {
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        staffPin: restaurant.staffPin || null,
        blocked: restaurant.blocked,
        trialEndsAt: restaurant.trialEndsAt,
        paidUntil: restaurant.paidUntil,
        billingExempt: restaurant.billingExempt,
      },
      billingEnabled,
      billingStatus: billing.status,
      trialDaysLeft: trialDaysLeft(billing.trialEndsAt),
      settings: settings
        ? {
            id: settings.id,
            restaurantName: settings.restaurantName,
            currency: settings.currency,
            themePrimary: settings.themePrimary,
            logoUrl: settings.logoUrl || null,
            logoWidth: settings.logoWidth ?? null,
            logoHeight: settings.logoHeight ?? null,
            logoSizeKB: settings.logoSizeKB ?? null,
            deliveryEnabled: settings.deliveryEnabled,
          }
        : { id: 0, restaurantName: "", currency: "EGP", themePrimary: "#C84C21", logoUrl: null, logoWidth: null, logoHeight: null, logoSizeKB: null, deliveryEnabled: true },
      categories: categories.map((c) => ({
        ...c,
        items: c.items.map((i) => ({
          ...i,
          sizeMode: (i.sizeMode === "weight" ? "weight" : "letters") as "letters" | "weight",
          imageWidth: i.imageWidth ?? null,
          imageHeight: i.imageHeight ?? null,
          imageSizeKB: i.imageSizeKB ?? null,
        })),
      })),
    };
  },
  ["admin-data"],
  { tags: [OWNER_TAG], revalidate: 30 }
);

/** بيانات لوحة الإدارة — مع كاش 60s + إبطال فوري عبر OWNER_TAG */
export async function getAdminData() {
  const restaurant = await getOwnerRestaurant();
  if (!restaurant) return null;
  return getAdminDataCached(restaurant.id);
}
