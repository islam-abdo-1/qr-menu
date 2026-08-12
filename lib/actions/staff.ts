"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant, OWNER_TAG } from "@/lib/data";
import { generateUniqueStaffPin, isStaffPinTaken } from "@/lib/staff-pin";
import { staffNameSchema } from "@/lib/validations";
import { isOwnerBillingExpired } from "@/lib/billing";

const staffInputSchema = z.object({
  enabled: z.boolean(),
  pin: z
    .string()
    .regex(/^\d{4}$/, "الكود السري يجب أن يكون 4 أرقام")
    .optional(),
});

export type StaffView = { id: string; name: string };

/** إعدادات الموظفين: تفعيل/إيقاف دخول /staff، وعرض/تغيير الكود الجماعي للفريق */
export async function updateStaffSettingsAction(input: {
  enabled: boolean;
  pin?: string;
}): Promise<ActionResult<{ pin: string } | null>> {
  const parsed = staffInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  }
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");

    let pin = "";
    if (parsed.data.enabled) {
      if (parsed.data.pin) {
        if (await isStaffPinTaken(parsed.data.pin, restaurant.id)) {
          return fail("هذا الكود مستخدم من مطعم آخر — اختر كودًا مختلفًا");
        }
        pin = parsed.data.pin;
      } else {
        pin = await generateUniqueStaffPin();
      }
    }

    try {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { staffPin: parsed.data.enabled ? pin : "" },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail("هذا الكود مستخدم من مطعم آخر — اختر كودًا مختلفًا");
      }
      throw e;
    }

    revalidateTag(OWNER_TAG);
    return ok(parsed.data.enabled ? { pin } : null);
  } catch (e) {
    console.error("[staff]", e);
    return fail("فشل حفظ إعدادات الموظفين");
  }
}

/* ───────────────────── قائمة الموظفين (اسم لكل موظف) ───────────────────── */

export async function listStaffAction(): Promise<ActionResult<StaffView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    const staff = await prisma.staff.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    return ok(staff);
  } catch (e) {
    console.error("[staff] list failed:", e);
    return fail("تعذّر تحميل الموظفين");
  }
}

export async function addStaffAction(name: string): Promise<ActionResult<StaffView[]>> {
  const parsed = staffNameSchema.safeParse({ name });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اسم غير صالح");
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");

    const count = await prisma.staff.count({ where: { restaurantId: restaurant.id } });
    if (count >= 50) return fail("الحد الأقصى 50 موظفًا");

    const existing = await prisma.staff.findFirst({
      where: {
        restaurantId: restaurant.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (existing) return fail("هذا الاسم موجود مسبقًا");

    await prisma.staff.create({
      data: { restaurantId: restaurant.id, name: parsed.data.name },
    });
    return ok(await listStaffFor(restaurant.id));
  } catch (e) {
    console.error("[staff] add failed:", e);
    return fail("حدث خطأ أثناء إضافة الموظف");
  }
}

export async function removeStaffAction(id: string): Promise<ActionResult<StaffView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff || staff.restaurantId !== restaurant.id) return fail("الموظف غير موجود");
    await prisma.staff.delete({ where: { id } });
    return ok(await listStaffFor(restaurant.id));
  } catch (e) {
    console.error("[staff] remove failed:", e);
    return fail("حدث خطأ أثناء حذف الموظف");
  }
}

async function listStaffFor(restaurantId: string): Promise<StaffView[]> {
  const staff = await prisma.staff.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  return staff;
}
