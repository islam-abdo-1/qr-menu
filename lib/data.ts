import "server-only";
import { unstable_cache as cache } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabase/server";

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
    sizes: MenuItemSize[];
    imageUrl: string | null;
    isAvailable: boolean;
  }[];
};

export type MenuData = {
  settings: {
    restaurantName: string;
    currency: string;
    themePrimary: string;
    logoUrl: string | null;
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
              sizes: { select: { sizeCode: true, price: true } },
              imageUrl: true,
              isAvailable: true,
            },
          },
        },
      }),
      prisma.$queryRaw<{ itemId: string }[]>`
        SELECT oi."itemId"
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."restaurantId" = ${restaurantId} AND oi."itemId" IS NOT NULL
          AND o."createdAt" >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}::timestamptz
        GROUP BY oi."itemId"
        ORDER BY SUM(oi."qty") DESC
        LIMIT 3
      `,
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
        items: c.items.filter((i) => i.isAvailable),
      }))
      .filter((c) => c.items.length > 0);

    return {
      settings: settings
        ? {
            restaurantName: settings.restaurantName,
            currency: settings.currency,
            themePrimary: settings.themePrimary,
            logoUrl: settings.logoUrl || null,
          }
        : null,
      categories: visible,
      bestSellers: bestSellers.map((b) => b.itemId),
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
 */
export const getMenuData = cache(
  async (slug?: string): Promise<MenuData | null> => {
    const restaurant = slug
      ? await prisma.restaurant.findUnique({ where: { slug } })
      : await prisma.restaurant.findFirst({ orderBy: { createdAt: "asc" } });
    return restaurant ? loadRestaurant(restaurant.id) : null;
  },
  ["qr-menu"],
  { tags: [MENU_TAG], revalidate: 300 },
);

/** استعلام المطعم نفسه بكاش قصير — id و slug ثابتان، والتغييرات تُمسح عبر OWNER_TAG */
const cachedOwner = cache(
  async (ownerId: string) =>
    prisma.restaurant.findUnique({ where: { ownerId } }),
  ["qr-menu-owner"],
  { tags: [OWNER_TAG], revalidate: 20 },
);

/** فك حمولة JWT محليًا — بلا شبكة وبلا تحقق توقيع (الكوكي HttpOnly فلا يمكن تزويره) */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const json = JSON.parse(payload);
    return typeof json === "object" && json !== null ? json : null;
  } catch {
    return null;
  }
}

/**
 * مستخدم Supabase من توكن الجلسة — مساران:
 *  1) توكن غير منتهٍ: فك محلي لمطالبة sub (صفر شبكة) — أسرع طريق لكل بولينج اللوحة.
 *  2) توكن منتهٍ: عميل SSR رسمي getUser() — يجدد التوكن عبر refresh token
 *     ويكتب الكوكيز الجديدة، فلا تُفقد الجلسة عند انتهاء ساعة التوكن أبدًا.
 */
async function resolveUserId(token: string): Promise<string | null> {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : null;
  const sub = payload?.sub;
  if (exp && exp > Date.now() && typeof sub === "string" && sub) return sub;
  try {
    const { user } = await getCurrentUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/** مطعم المالك الحالي من الجلسة — تُستخدم في لوحة الإدارة وكل إجراءات التعديل */
/** استخراج توكن الوصول من كوكيز جلسة Supabase SSR:
 *  القيمة بصيغة base64-<json> (أو JWT خام في بعض الإعدادات) — لا تُمرَّر كما هي. */
function tokenFromSessionCookie(value: string): string | null {
  if (!value.startsWith("base64-")) return value || null;
  try {
    const b64 = value.slice(7).replace(/-/g, "+").replace(/_/g, "/");
    const session = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return typeof session.access_token === "string" ? session.access_token : null;
  } catch {
    return null;
  }
}

/** مطعم المالك الحالي من الجلسة — تُستخدم في لوحة الإدارة وكل إجراءات التعديل */
export async function getOwnerRestaurant() {
  const cookie = cookies()
    .getAll()
    .find((c) => c.name.endsWith("-auth-token"));
  const token = cookie ? tokenFromSessionCookie(cookie.value) : null;
  if (!token) return null;
  const userId = await resolveUserId(token);
  if (!userId) return null;
  return cachedOwner(userId);
}

/** بيانات حيّة (بدون كاش) — داخل لوحة الإدارة فقط، مقيدة بمطعم المالك */
export async function getAdminData() {
  const restaurant = await getOwnerRestaurant();
  if (!restaurant) return null;

  const [settings, categories] = await Promise.all([
    prisma.setting.findUnique({ where: { restaurantId: restaurant.id } }),
    prisma.category.findMany({
      where: { restaurantId: restaurant.id },
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
            sizes: { select: { sizeCode: true, price: true } },
            imageUrl: true,
            isAvailable: true,
          },
        },
      },
    }),
  ]);

  return {
    restaurant: { id: restaurant.id, slug: restaurant.slug, staffPin: restaurant.staffPin || null },
    settings: settings
      ? {
          id: settings.id,
          restaurantName: settings.restaurantName,
          currency: settings.currency,
          themePrimary: settings.themePrimary,
          logoUrl: settings.logoUrl || null,
        }
      : { id: 0, restaurantName: "", currency: "EGP", themePrimary: "#C84C21", logoUrl: null },
    categories,
  };
}
