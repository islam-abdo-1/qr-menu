"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { categorySchema, imageUploadSchema, menuItemSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary/upload";
import { getBillingEnabled, getBillingInfo, isBillingExpired } from "@/lib/billing";

const TAG = "menu";

function bumpMenuCache() {
  revalidateTag(TAG);
}

function diskError(e: unknown) {
  console.error("[menu action]", e);
  return fail("حدث خطأ غير متوقع أثناء حفظ البيانات");
}

/** مطعم المالك من الجلسة — بدون مطعم (أو محظور/منتهي الاشتراك) لا توجد أي عملية تعديل */
async function requireOwnerRestaurant() {
  const restaurant = await getOwnerRestaurant();
  if (!restaurant || restaurant.blocked) return null;
  const billingEnabled = await getBillingEnabled();
  if (isBillingExpired(getBillingInfo(restaurant, billingEnabled))) return null;
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
      include: { items: { select: { imageUrl: true, imagePublicId: true } } },
    });
    if (!category || category.restaurantId !== restaurant.id) return fail("القسم غير موجود");

    // احذف صور العناصر التابعة من Cloudinary
    for (const item of category.items) {
      if (item.imagePublicId) {
        await deleteFromCloudinary(item.imagePublicId);
      }
    }

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
  price?: number | string;
  categoryId: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
  sizeMode?: "letters" | "weight";
  discountPercentage?: number | null;
  sizes?: { sizeCode: string; price: number | string }[];
};

/** عند وجود مقاسات: السعر العادي يُحسب من أقل مقاس — نُلغيه من المدخلات ولا نطلبه */
function normalizeBasePrice(input: MenuItemInput): MenuItemInput {
  const hasSizes = (input.sizes?.length ?? 0) > 0;
  return hasSizes ? { ...input, price: undefined } : input;
}

export async function createMenuItemAction(
  input: MenuItemInput,
): Promise<ActionResult<{ id: string }>> {
  // مع وجود مقاسات يصبح السعر العادي محسوبًا تلقائيًا من أقل مقاس — لا يُطلب من المستخدم
  const normalized = normalizeBasePrice(input);
  const parsed = menuItemSchema.safeParse(normalized);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.restaurantId !== restaurant.id) return fail("القسم غير موجود");

    const imagePublicId = null;
    const imageUrl = parsed.data.imageUrl || null;

    // إذا تم رفع صورة جديدة، ارفعها إلى Cloudinary
    if (parsed.data.imageUrl && parsed.data.imageUrl.startsWith('data:')) {
      // التعامل مع base64 إذا تم إرساله (للحالات النادرة)
      // في الوضع الطبيعي، الصورة ترفع من العميل عبر upload action منفصل
    }

    const item = await prisma.menuItem.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price ?? Math.min(...(parsed.data.sizes ?? []).map((s) => Number(s.price))),
        categoryId: parsed.data.categoryId,
        restaurantId: restaurant.id,
        imageUrl,
        imagePublicId,
        isAvailable: parsed.data.isAvailable ?? true,
        sizeMode: parsed.data.sizeMode ?? "letters",
        discountPercentage: parsed.data.discountPercentage || null,
        sizes: parsed.data.sizes?.length
          ? { create: parsed.data.sizes.map((s) => ({ sizeCode: s.sizeCode, price: s.price })) }
          : undefined,
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
  const normalized = normalizeBasePrice(input);
  const parsed = menuItemSchema.safeParse(normalized);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await requireOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing || existing.restaurantId !== restaurant.id) return fail("العنصر غير موجود");

    let imagePublicId = existing.imagePublicId;
    const _imageUrl = parsed.data.imageUrl ?? existing.imageUrl;

    // إذا تم تحديث الصورة، احذف القديمة من Cloudinary وارفع الجديدة
    if (parsed.data.imageUrl && parsed.data.imageUrl !== existing.imageUrl) {
      if (existing.imagePublicId) {
        await deleteFromCloudinary(existing.imagePublicId);
      }
      imagePublicId = null; // سيتم تعيينه عند الرفع الفعلي
    }

    await prisma.menuItem.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        price: parsed.data.price ?? Math.min(...(parsed.data.sizes ?? []).map((s) => Number(s.price))),
        categoryId: parsed.data.categoryId,
        imageUrl: parsed.data.imageUrl ?? null,
        imagePublicId,
        isAvailable: parsed.data.isAvailable ?? existing.isAvailable,
        sizeMode: parsed.data.sizeMode ?? existing.sizeMode,
        discountPercentage: parsed.data.discountPercentage || null,
        sizes: {
          deleteMany: {},
          create: parsed.data.sizes?.map((s) => ({ sizeCode: s.sizeCode, price: s.price })) ?? [],
        },
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

    if (existing.imagePublicId) {
      await deleteFromCloudinary(existing.imagePublicId);
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

/* ───────────────────── رفع الصور إلى Cloudinary ───────────────────── */

export async function uploadMenuItemImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string; width: number; height: number; sizeKB: number; publicId: string }>> {
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("لم يتم اختيار صورة");

  // قراءة البيانات الوصفية المرسلة من العميل (عرض، ارتفاع، حجم بالكيلوبايت)
  const _width = Number(formData.get("width") ?? "0");
  const _height = Number(formData.get("height") ?? "0");
  const _sizeKB = Number(formData.get("sizeKB") ?? "0");

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
    const _isWebp = file.type === "image/webp";

    const uploadResult = await uploadToCloudinary({
      folder: `qr-menu/items/${restaurant.id}`,
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 1200, crop: 'limit' }
      ],
      buffer: Buffer.from(bytes),
    });

    if (!uploadResult.ok) {
      console.error("[upload]", uploadResult.error);
      return fail("فشل رفع الصورة إلى Cloudinary");
    }

    return ok({ 
      url: uploadResult.data!.url, 
      width: uploadResult.data!.width, 
      height: uploadResult.data!.height, 
      sizeKB: uploadResult.data!.sizeKB,
      publicId: uploadResult.data!.publicId
    });
  } catch (e) {
    console.error("[upload]", e);
    return fail("فشل رفع الصورة");
  }
}
