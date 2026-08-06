import "server-only";
import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/lib/prisma";

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
};

async function fetchAll(): Promise<MenuData> {
  try {
    const [settings, categories] = await Promise.all([
      prisma.setting.findFirst(),
      prisma.category.findMany({
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
    };
  } catch (e) {
    // عدم توقف الصفحة العامة عند تعذّر الاتصال (ISR يعيد البناء تلقائيًا عند التعديل)
    console.error("[data] قاعدة البيانات غير متاحة:", e);
    return { settings: null, categories: [] };
  }
}

/**
 * البيانات المخزّنة في كاش ISR لمدة 60 ثانية (وتُحدَّث فورًا من لوحة الإدارة
 * عبر revalidateTag). الصفحة العامة لا تلمس قاعدة البيانات على الإطلاق عند الطلب.
 */
/**
 * البيانات المخزّنة في كاش ISR لمدة 60 ثانية (وتُحدَّث فورًا من لوحة الإدارة
 * عبر revalidateTag). الصفحة العامة لا تلمس قاعدة البيانات على الإطلاق عند الطلب.
 */
export const getMenuData = cache(fetchAll, ["qr-menu"], {
  tags: [MENU_TAG],
  revalidate: 60,
});

/** بيانات حيّة (بدون كاش) — تُستخدم داخل لوحة الإدارة فقط */
export async function getAdminData() {
  const [settings, categories] = await Promise.all([
    prisma.setting.findFirst(),
    prisma.category.findMany({
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
    settings: settings
      ? {
          id: settings.id,
          restaurantName: settings.restaurantName,
          currency: settings.currency,
          themePrimary: settings.themePrimary,
          logoUrl: settings.logoUrl || null,
        }
      : { id: 1, restaurantName: "", currency: "EGP", themePrimary: "#C84C21", logoUrl: null },
    categories,
  };
}