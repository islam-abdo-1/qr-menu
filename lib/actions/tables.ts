"use server";

import { revalidateTag } from "next/cache";
import { unstable_cache as cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant, MENU_TAG } from "@/lib/data";
import { isOwnerBillingExpired } from "@/lib/billing";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";

export type TableView = { id: string; number: number; reserved: boolean };

const TABLES_TAG = "tables";

/** قائمة الطاولات بكاش قصير (30 ثانية) — تُمسح فورًا عند أي تعديل */
const loadTables = cache(
  async (restaurantId: string): Promise<TableView[]> => {
    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, reserved: true },
    });
    return tables;
  },
  ["qr-menu-tables"],
  { tags: [TABLES_TAG], revalidate: 30 },
);

export async function listTablesAction(): Promise<ActionResult<TableView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    return ok(await loadTables(restaurant.id));
  } catch (e) {
    console.error("[tables] list failed:", e);
    return fail("تعذّر تحميل الطاولات");
  }
}

export async function addTableAction(number: number): Promise<ActionResult<TableView[]>> {
  const n = Math.floor(Number(number));
  if (!Number.isFinite(n) || n < 1 || n > 999) return fail("رقم الطاولة يجب أن يكون بين 1 و 999");
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    const existing = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: n } },
    });
    if (existing) return fail("هذه الطاولة موجودة مسبقًا");
    const count = await prisma.table.count({ where: { restaurantId: restaurant.id } });
    if (count >= 50) return fail("الحد الأقصى 50 طاولة");
    await prisma.table.create({ data: { restaurantId: restaurant.id, number: n } });
    revalidateTag(TABLES_TAG);
    revalidateTag(MENU_TAG);
    return ok(await listTablesFor(restaurant.id));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("هذه الطاولة موجودة مسبقًا");
    }
    console.error("[tables] add failed:", e);
    return fail("حدث خطأ أثناء إضافة الطاولة");
  }
}

export async function removeTableAction(id: string): Promise<ActionResult<TableView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table || table.restaurantId !== restaurant.id) return fail("الطاولة غير موجودة");
    await prisma.table.delete({ where: { id } });
    revalidateTag(TABLES_TAG);
    revalidateTag(MENU_TAG);
    return ok(await listTablesFor(restaurant.id));
  } catch (e) {
    console.error("[tables] remove failed:", e);
    return fail("حدث خطأ أثناء حذف الطاولة");
  }
}

export async function toggleTableReservedAction(id: string): Promise<ActionResult<TableView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table || table.restaurantId !== restaurant.id) return fail("الطاولة غير موجودة");
    await prisma.table.update({ where: { id }, data: { reserved: !table.reserved } });
    revalidateTag(TABLES_TAG);
    revalidateTag(MENU_TAG);
    return ok(await listTablesFor(restaurant.id));
  } catch (e) {
    console.error("[tables] toggle failed:", e);
    return fail("حدث خطأ أثناء تحديث حالة الطاولة");
  }
}

async function listTablesFor(restaurantId: string): Promise<TableView[]> {
  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, reserved: true },
  });
  return tables;
}
