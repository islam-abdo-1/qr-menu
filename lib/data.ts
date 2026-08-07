import "server-only";
import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/** العلامة المستخدمة لكل تجديد بعد التعديل من لوحة الإدارة */
export const MENU_TAG = "menu";

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: {
    id: string;
    name: string;
    description: string | null;
    price: number;
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
};

async function loadRestaurant(restaurantId: string): Promise<MenuData> {
  try {
    const [settings, categories, bestSellers] = await Promise.all([
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
 * البيانات في كاش ISR لمدة 60 ثانية (تُحدَّث فورًا من لوحة الإدارة عبر revalidateTag).
 */
export const getMenuData = cache(
  async (slug?: string): Promise<MenuData | null> => {
    const restaurant = slug
      ? await prisma.restaurant.findUnique({ where: { slug } })
      : await prisma.restaurant.findFirst({ orderBy: { createdAt: "asc" } });
    return restaurant ? loadRestaurant(restaurant.id) : null;
  },
  ["qr-menu"],
  { tags: [MENU_TAG], revalidate: 60 },
);

/** مطعم المالك الحالي من الجلسة — تُستخدم في لوحة الإدارة وكل إجراءات التعديل */
export async function getOwnerRestaurant() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return prisma.restaurant.findUnique({ where: { ownerId: user.id } });
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
