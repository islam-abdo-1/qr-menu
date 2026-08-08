"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { createClient } from "@/lib/supabase/server";
import { MENU_TAG } from "@/lib/data";

/** زبون مسجّل دخول — بدون جلسة لا توجد تفضيلات */
async function requireCustomerId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** معرّفات العناصر المفضلة للزبون الحالي (للتحميل الأول) */
export async function getMyFavoritesAction(): Promise<ActionResult<string[]>> {
  const userId = await requireCustomerId();
  if (!userId) return ok([]);
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: { itemId: true },
    });
    return ok(rows.map((r) => r.itemId));
  } catch (e) {
    console.error("[favorites]", e);
    return fail("تعذّر تحميل التفضيلات");
  }
}

/** إضافة/إزالة عنصر من التفضيلات — يعيد الحالة الجديدة */
export async function toggleFavoriteAction(
  itemId: string,
): Promise<ActionResult<{ favorite: boolean }>> {
  const userId = await requireCustomerId();
  if (!userId) return fail("سجّل دخولك أولًا لحفظ التفضيلات");

  const parsed = z.string().min(1).safeParse(itemId);
  if (!parsed.success) return fail("عنصر غير صالح");

  try {
    const item = await prisma.menuItem.findUnique({ where: { id: parsed.data } });
    if (!item) return fail("العنصر غير موجود");

    const existing = await prisma.favorite.findUnique({
      where: { userId_itemId: { userId, itemId: parsed.data } },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      revalidateTag(MENU_TAG);
      return ok({ favorite: false });
    }

    await prisma.favorite.create({ data: { userId, itemId: parsed.data } });
    revalidateTag(MENU_TAG);
    return ok({ favorite: true });
  } catch (e) {
    console.error("[favorites]", e);
    return fail("تعذّر حفظ التفضيل");
  }
}

/** عناصر "مفضلتي" كاملة لبيانات العرض (بالمنيو العام نعرض المتاح منها فقط) */
export async function getFavoriteItemsAction(): Promise<
  ActionResult<
    {
      id: string;
      name: string;
      price: number;
      discountPercentage: number | null;
      imageUrl: string | null;
      categoryName: string;
    }[]
  >
> {
  const userId = await requireCustomerId();
  if (!userId) return ok([]);
  try {
    const rows = await prisma.favorite.findMany({
      where: { userId },
      select: {
        itemId: true,
        item: {
          select: {
            id: true,
            name: true,
            price: true,
            discountPercentage: true,
            imageUrl: true,
            isAvailable: true,
            category: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      rows
        .filter((r) => r.item.isAvailable)
        .map((r) => ({
          id: r.item.id,
          name: r.item.name,
          price: r.item.price,
          discountPercentage: r.item.discountPercentage,
          imageUrl: r.item.imageUrl,
          categoryName: r.item.category.name,
        })),
    );
  } catch (e) {
    console.error("[favorites]", e);
    return fail("تعذّر تحميل التفضيلات");
  }
}
