"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { imageUploadSchema, settingsSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { imagePathFromUrl } from "@/lib/supabase/storage";
import { isOwnerBillingExpired } from "@/lib/billing";

const BUCKET = "menu-images";

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

    // حذف الشعار القديم من التخزين عند استبداله أو إزالته
    if (existing?.logoUrl) {
      const newLogo = parsed.data.logoUrl || null;
      if (newLogo === null || imagePathFromUrl(existing.logoUrl) !== imagePathFromUrl(newLogo)) {
        const supabase = createClient();
        await supabase.storage.from(BUCKET).remove([imagePathFromUrl(existing.logoUrl)]);
      }
    }

    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: parsed.data });
    } else {
      await prisma.setting.create({
        data: { ...parsed.data, restaurantId: restaurant.id },
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

/** رفع شعار المطعم إلى التخزين (يُعرض في الهيرو والفوتر بإطار ذهبي) */
export async function uploadLogoImageAction(
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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isWebp = file.type === "image/webp";
    const path = `logo/${crypto.randomUUID()}.${isWebp ? "webp" : "jpg"}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: isWebp ? "image/webp" : "image/jpeg",
      cacheControl: "3600",
    });
    if (error) {
      console.error("[logo upload]", error);
      return fail(
        error.message.includes("permission")
          ? "لا تملك صلاحية الرفع — تحقق من سياسات التخزين"
          : "فشل رفع الشعار إلى التخزين",
      );
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return ok({ url: data.publicUrl });
  } catch (e) {
    console.error("[logo upload]", e);
    return fail("فشل رفع الشعار");
  }
}