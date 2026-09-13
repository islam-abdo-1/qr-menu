"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { imageUploadSchema, settingsSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { uploadToCloudinary, deleteFromCloudinary } from "@/lib/cloudinary/upload";
import { isOwnerBillingExpired } from "@/lib/billing";

export async function updateSettingsAction(
  input: z.infer<typeof settingsSchema>,
): Promise<ActionResult<null>> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");

    const existing = await prisma.setting.findUnique({
      where: { restaurantId: restaurant.id },
    });

    // حذف الشعار القديم من Cloudinary عند استبداله أو إزالته
    if (existing?.logoPublicId) {
      const newLogo = parsed.data.logoUrl || null;
      if (newLogo === null) {
        await deleteFromCloudinary(existing.logoPublicId);
      }
    }

    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: parsed.data });
    } else {
      await prisma.setting.create({
        data: { ...parsed.data, restaurantId: restaurant.id },
      });
    }
    
    // تحديث logoPublicId إذا تم رفع شعار جديد
    if (parsed.data.logoUrl && existing?.logoPublicId !== parsed.data.logoPublicId) {
      await prisma.setting.update({
        where: { restaurantId: restaurant.id },
        data: { logoPublicId: parsed.data.logoPublicId }
      });
    }
    // مزامنة اسم المطعم في السجل الرسمي حتى لا يتباعد الاسم بين الشاشات
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { name: parsed.data.restaurantName },
    });
    revalidateTag("menu");
    return ok(null);
  } catch (e) {
    console.error("[settings]", e);
    return fail("فشل حفظ الإعدادات");
  }
}

/** رفع شعار المطعم إلى Cloudinary (يُعرض في الهيرو والفوتر بإطار ذهبي) */
export async function uploadLogoImageAction(
  formData: FormData,
): Promise<ActionResult<{ url: string; width: number; height: number; sizeKB: number; publicId: string }>> {
  // قراءة البيانات الوصفية المرسلة من العميل (عرض، ارتفاع، حجم بالكيلوبايت)
  const _width = Number(formData.get("width") ?? "0");
  const _height = Number(formData.get("height") ?? "0");
  const _sizeKB = Number(formData.get("sizeKB") ?? "0");

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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const _isWebp = file.type === "image/webp";

    const uploadResult = await uploadToCloudinary({
      folder: `qr-menu/logos`,
      transformation: [
        { quality: 'auto', fetch_format: 'auto' },
        { width: 400, height: 400, crop: 'fill', gravity: 'face' }
      ],
      buffer: Buffer.from(bytes),
    });

    if (!uploadResult.ok) {
      console.error("[logo upload]", uploadResult.error);
      return fail("فشل رفع الشعار إلى Cloudinary");
    }

    return ok({ 
      url: uploadResult.data!.url, 
      width: uploadResult.data!.width, 
      height: uploadResult.data!.height, 
      sizeKB: uploadResult.data!.sizeKB,
      publicId: uploadResult.data!.publicId
    });
  } catch (e) {
    console.error("[logo upload]", e);
    return fail("فشل رفع الشعار");
  }
}
