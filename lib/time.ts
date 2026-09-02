/**
 * PHASE 5.2 — المصدر الوحيد لتعريف «يوم القاهرة» (يوم عمل المطعم).
 * كل العدّادات والتقارير وحدود DayStat تستخدم هذه الدوال فقط —
 * أي تعديل هنا يُطبَّق على النظام كله تلقائيًا.
 */

export const CAIRO_TIME_ZONE = "Africa/Cairo";

/** تاريخ اليوم بتوقيت القاهرة بصيغة YYYY-MM-DD (يوم عمل المطعم) */
export function cairoDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * بداية اليوم بتوقيت القاهرة كـ UTC — لتوافق تصفية الطلبات مع حدود DayStat:
 * اليوم يبدأ عند منتصف الليل في القاهرة لا في UTC (مصر +2/+3).
 */
export function cairoDayStartUtc(d: Date): Date {
  const ymd = cairoDateString(d);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TIME_ZONE,
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

/** أيام قبل تاريخ معطى — للصيانة المجدولة/حدود الاحتفاظ (مضاف من maintenance) */
export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
