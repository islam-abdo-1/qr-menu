"use server";

import { unstable_cache as cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { isOwnerBillingExpired } from "@/lib/billing";

const ORDER_TAG = "orders";

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

/** حساب التقرير بكاش 30 ثانية — يُمسح تلقائيًا عند إنشاء طلب جديد (tag orders) */
const loadReport = cache(
  async (restaurantId: string, period: ReportPeriod): Promise<SalesReport> => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (period === "today" ? 0 : period === "7d" ? 6 : 29));
    const fromStr = cairoDate(from);

    const [days, bestSellers] = await Promise.all([
      prisma.$queryRaw<
        { date: Date; revenue: number; orders: number; dineIn: number; delivery: number }[]
      >`
        SELECT "date", "revenue", "orders", "dineIn", "delivery"
        FROM "DayStat"
        WHERE "restaurantId" = ${restaurantId} AND "date" >= ${fromStr}::date
        ORDER BY "date" ASC
      `,
      prisma.$queryRaw<{ name: string; qty: number; revenue: number }[]>`
        SELECT oi."name", SUM(oi."qty")::int AS qty, SUM(oi."price" * oi."qty")::float8 AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        WHERE o."restaurantId" = ${restaurantId} AND o."createdAt" >= ${cairoDayStartUtc(from)}::timestamptz
        GROUP BY oi."name"
        ORDER BY qty DESC
        LIMIT 5
      `,
    ]);

    const revenue = days.reduce((s, d) => s + d.revenue, 0);
    const orders = days.reduce((s, d) => s + d.orders, 0);
    const dineIn = days.reduce((s, d) => s + d.dineIn, 0);
    const delivery = days.reduce((s, d) => s + d.delivery, 0);

    return {
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
    };
  },
  ["qr-menu-sales-report"],
  { tags: [ORDER_TAG], revalidate: 30 },
);

export async function getSalesReportAction(
  period: ReportPeriod,
): Promise<ActionResult<SalesReport>> {
  if (!["today", "7d", "30d"].includes(period)) return fail("فترة غير صالحة");
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");

    const report = await loadReport(restaurant.id, period);
    return ok(report);
  } catch (e) {
    console.error("[reports] failed:", e);
    return fail("تعذّر تحميل التقرير");
  }
}

/* ─────────────────────────── عدّاد فتحات المنيو (QR visits) ─────────────────────────── */

export type VisitsStats = {
  today: number;
  thisMonth: number;
};

/** تجميع عدّاد الفتحات من DayStat — يومي + شهري (قيمة مستقلة عن كاش التقارير) */
const loadVisits = cache(
  async (restaurantId: string): Promise<VisitsStats> => {
    const todayStr = cairoDate(new Date());
    const monthStr = todayStr.slice(0, 7);

    const rows = await prisma.$queryRaw<{ date: Date; scans: number }[]>`
      SELECT "date", "scans"
      FROM "DayStat"
      WHERE "restaurantId" = ${restaurantId}
        AND "date" >= ${`${monthStr}-01`}::date
      ORDER BY "date" ASC
    `;
    const totals = rows.reduce(
      (acc, r) => {
        const iso = r.date.toISOString().slice(0, 10);
        acc.thisMonth += r.scans;
        if (iso === todayStr) acc.today += r.scans;
        return acc;
      },
      { today: 0, thisMonth: 0 },
    );
    return totals;
  },
  ["qr-menu-visits"],
  { tags: ["visits"], revalidate: 60 },
);

export async function getVisitsAction(): Promise<ActionResult<VisitsStats>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    if (await isOwnerBillingExpired(restaurant)) return fail("انتهت الفترة المجانية — جدّد اشتراكك");
    return ok(await loadVisits(restaurant.id));
  } catch (e) {
    console.error("[visits] load failed:", e);
    return fail("تعذّر تحميل عدّاد الفتحات");
  }
}
