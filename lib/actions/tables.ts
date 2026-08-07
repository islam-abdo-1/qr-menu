"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";

export type TableView = { id: string; number: number };

export async function listTablesAction(): Promise<ActionResult<TableView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    const tables = await prisma.table.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { number: "asc" },
      select: { id: true, number: true },
    });
    return ok(tables);
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
    const existing = await prisma.table.findUnique({
      where: { restaurantId_number: { restaurantId: restaurant.id, number: n } },
    });
    if (existing) return fail("هذه الطاولة موجودة مسبقًا");
    const count = await prisma.table.count({ where: { restaurantId: restaurant.id } });
    if (count >= 50) return fail("الحد الأقصى 50 طاولة");
    await prisma.table.create({ data: { restaurantId: restaurant.id, number: n } });
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
    const table = await prisma.table.findUnique({ where: { id } });
    if (!table || table.restaurantId !== restaurant.id) return fail("الطاولة غير موجودة");
    await prisma.table.delete({ where: { id } });
    return ok(await listTablesFor(restaurant.id));
  } catch (e) {
    console.error("[tables] remove failed:", e);
    return fail("حدث خطأ أثناء حذف الطاولة");
  }
}

async function listTablesFor(restaurantId: string): Promise<TableView[]> {
  const tables = await prisma.table.findMany({
    where: { restaurantId },
    orderBy: { number: "asc" },
    select: { id: true, number: true },
  });
  return tables;
}
