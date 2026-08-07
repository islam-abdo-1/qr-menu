"use server";

import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";

export type ReportPeriod = "today" | "7d" | "30d";

export type SalesReport = {
  period: ReportPeriod;
  totals: {
    revenue: number;
    orders: number;
    avg: number;
    dineIn: number;
    delivery: number;
  };
  byDay: { date: string; label: string; revenue: number; orders: number }[];
  bestSellers: { name: string; qty: number; revenue: number }[];
};

/** تاريخ اليوم بتوقيت القاهرة بصيغة YYYY-MM-DD (يوم عمل المطعم) */
function cairoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** بداية اليوم بتوقيت القاهرة كـ UTC — لتوافق تصفية الطلبات مع حدود DayStat */
function cairoDayStartUtc(d: Date): Date {
  const ymd = cairoDate(d);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const wallSec = (+parts.hour * 60 + +parts.minute) * 60 + +parts.second;
  const utcSec = (d.getUTCHours() * 60 + d.getUTCMinutes()) * 60 + d.getUTCSeconds();
  const offsetSec = (wallSec - utcSec + 86400) % 86400;
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() - offsetSec * 1000);
}

/** تسمية يومية عربية قصيرة مثل "12 يوليو" */
function labelFor(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(d);
}

export async function getSalesReportAction(
  period: ReportPeriod,
): Promise<ActionResult<SalesReport>> {
  if (!["today", "7d", "30d"].includes(period)) return fail("فترة غير صالحة");
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (period === "today" ? 0 : period === "7d" ? 6 : 29));
    const fromStr = cairoDate(from);

    const days = await prisma.$queryRaw<
      { date: Date; revenue: number; orders: number; dineIn: number; delivery: number }[]
    >`
      SELECT "date", "revenue", "orders", "dineIn", "delivery"
      FROM "DayStat"
      WHERE "restaurantId" = ${restaurant.id} AND "date" >= ${fromStr}::date
      ORDER BY "date" ASC
    `;

    const revenue = days.reduce((s, d) => s + d.revenue, 0);
    const orders = days.reduce((s, d) => s + d.orders, 0);
    const dineIn = days.reduce((s, d) => s + d.dineIn, 0);
    const delivery = days.reduce((s, d) => s + d.delivery, 0);

    const bestSellers = await prisma.$queryRaw<{ name: string; qty: number; revenue: number }[]>`
      SELECT oi."name", SUM(oi."qty")::int AS qty, SUM(oi."price" * oi."qty")::float8 AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."restaurantId" = ${restaurant.id} AND o."createdAt" >= ${cairoDayStartUtc(from)}::timestamptz
      GROUP BY oi."name"
      ORDER BY qty DESC
      LIMIT 5
    `;

    return ok({
      period,
      totals: {
        revenue,
        orders,
        avg: orders > 0 ? revenue / orders : 0,
        dineIn,
        delivery,
      },
      byDay: days.map((d) => {
        const iso = d.date.toISOString().slice(0, 10);
        return { date: iso, label: labelFor(iso), revenue: d.revenue, orders: d.orders };
      }),
      bestSellers,
    });
  } catch (e) {
    console.error("[reports] failed:", e);
    return fail("تعذّر تحميل التقرير");
  }
}
