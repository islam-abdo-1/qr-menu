"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categorySchema, imageUploadSchema, menuItemSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { imagePathFromUrl } from "@/lib/supabase/storage";

const TAG = "menu";
const BUCKET = "menu-images";

function bumpMenuCache() {
  revalidateTag(TAG);
}

function diskError(e: unknown) {
  console.error("[menu action]", e);
  return fail("حدث خطأ غير متوقع أثناء حفظ البيانات");
}

/** مطعم المالك من الجلسة — بدون مطعم لا توجد أي عملية تعديل */
async function requireOwnerRestaurant() {
  const restaurant = await getOwnerRestaurant();
  if (!restaurant) return null;
  return restaurant;
}

/* ───────────────────────── الأقسام ───────────────────────── */

export async function createCategoryAction(
  name: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse({ name });
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const count = await prisma.category.count({
      where: { restaurantId: restaurant.id },
    });
    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        sortOrder: count + 1,
        restaurantId: restaurant.id,
      },
    });
    bumpMenuCache();
    return ok({ id: category.id });
  } catch (e) {
    return diskError(e);
  }
}

export async function updateCategoryAction(
  id: string,
  name: string,
  sortOrder: number,
): Promise<ActionResult<null>> {
  const parsed = categorySchema.safeParse({ name, sortOrder });
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== restaurant.id) return fail("القسم غير موجود");

    await prisma.category.update({ where: { id }, data: parsed.data });
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<null>> {
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const category = await prisma.category.findUnique({
      where: { id },
      include: { items: { select: { imageUrl: true } } },
    });
    if (!category || category.restaurantId !== restaurant.id) return fail("القسم غير موجود");

    // احذف صور العناصر التابعة
    const supabase = createClient();
    const paths = category.items
      .map((item) => item.imageUrl)
      .filter(Boolean)
      .map((p) => imagePathFromUrl(p!));
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

    await prisma.category.delete({ where: { id } });
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

export async function reorderCategoriesAction(ids: string[]): Promise<ActionResult<null>> {
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const owned = await prisma.category.findMany({
      where: { id: { in: ids }, restaurantId: restaurant.id },
      select: { id: true },
    });
    if (owned.length !== ids.length) return fail("بعض الأقسام غير موجودة");

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.category.update({ where: { id }, data: { sortOrder: index + 1 } }),
      ),
    );
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

/* ───────────────────────── عناصر المنيو ───────────────────────── */

/** مدخلات مرنة من الواجهة (السعر قد يأتي نصيًا قبل التحويل داخل zod) */
export type MenuItemInput = {
  name: string;
  description?: string;
  price: number | string;
  categoryId: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
};

export async function createMenuItemAction(
  input: MenuItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.restaurantId !== restaurant.id) return fail("القسم غير موجود");

    const item = await prisma.menuItem.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        categoryId: parsed.data.categoryId,
        restaurantId: restaurant.id,
        imageUrl: parsed.data.imageUrl || null,
        isAvailable: parsed.data.isAvailable ?? true,
      },
    });
    bumpMenuCache();
    return ok({ id: item.id });
  } catch (e) {
    return diskError(e);
  }
}

export async function updateMenuItemAction(
  id: string,
  input: MenuItemInput,
): Promise<ActionResult<null>> {
  const parsed = menuItemSchema.safeParse(input);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== restaurant.id) return fail("العنصر غير موجود");

    // صورة جديدة تستبدل القديمة في Storage
    const oldImage = existing.imageUrl ? imagePathFromUrl(existing.imageUrl) : null;
    const newImage = parsed.data.imageUrl ? imagePathFromUrl(parsed.data.imageUrl) : null;
    if (oldImage && newImage && oldImage !== newImage) {
      const supabase = createClient();
      await supabase.storage.from(BUCKET).remove([oldImage]);
    }

    await prisma.menuItem.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price,
        categoryId: parsed.data.categoryId,
        imageUrl: parsed.data.imageUrl || null,
        isAvailable: parsed.data.isAvailable ?? existing.isAvailable,
      },
    });
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

export async function deleteMenuItemAction(id: string): Promise<ActionResult<null>> {
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== restaurant.id) return fail("العنصر غير موجود");

    if (existing.imageUrl) {
      const supabase = createClient();
      await supabase.storage
        .from(BUCKET)
        .remove([imagePathFromUrl(existing.imageUrl)]);
    }

    await prisma.menuItem.delete({ where: { id } });
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

export async function toggleItemAvailabilityAction(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult<null>> {
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== restaurant.id) return fail("العنصر غير موجود");

    await prisma.menuItem.update({ where: { id }, data: { isAvailable } });
    bumpMenuCache();
    return ok(null);
  } catch (e) {
    return diskError(e);
  }
}

/* ───────────────────── رفع الصور إلى Supabase Storage ───────────────────── */

export async function uploadMenuItemImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("لم يتم اختيار صورة");

  const parsed = imageUploadSchema.safeParse({
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (!parsed.success) {
    const { error } = fromZod(parsed.error);
    return fail(error);
  }

  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isWebp = file.type === "image/webp";
    const ext = isWebp ? "webp" : "jpg";
    const path = `items/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: isWebp ? "image/webp" : "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      console.error("[upload]", error);
      return fail(error.message.includes("permission")
        ? "لا تملك صلاحية الرفع — فعّل سياسات RLS في Storage"
        : "فشل رفع الصورة إلى التخزين");
    }
    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return ok({ url: publicData.publicUrl });
  } catch (e) {
    console.error("[upload]", e);
    return fail("فشل رفع الصورة");
  }
}
