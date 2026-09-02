import { describe, expect, it } from "vitest";
import { CAIRO_TIME_ZONE, cairoDateString, cairoDayStartUtc, daysAgo } from "@/lib/time";

/**
 * مرجع غير دائري: يحسب إزاحة القاهرة الحقيقية (UTC+2/+3 حسب DST) عبر
 * timeZoneName من Intl، ثم يبني التاريخ المتوقع حسابيًا — لا ننسخ التنفيذ.
 */
function cairoOffsetMs(d: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: CAIRO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  });
  const tz = fmt.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) throw new Error(`cannot parse offset: ${tz}`);
  const sign = m[1] === "+" ? 1 : -1;
  return sign * (+m[2] * 60 + +m[3]) * 60 * 1000;
}

function expectedCairoDate(d: Date): string {
  const wall = new Date(d.getTime() + cairoOffsetMs(d));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${wall.getUTCFullYear()}-${p(wall.getUTCMonth() + 1)}-${p(wall.getUTCDate())}`;
}

describe("PHASE 5.2 — يوم القاهرة: المصدر الوحيد", () => {
  it("يوم عادي: التاريخ يطابق الحساب المباشر بإزاحة القاهرة الحقيقية", () => {
    const d = new Date("2026-07-15T10:30:00Z"); // ظهر-ميل القاهرة
    expect(cairoDateString(d)).toBe(expectedCairoDate(d));
    expect(cairoDateString(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("حد منتصف الليل: لحظة قرب منتصف الليل بتوقيت القاهرة تنتمي لليوم الصحيح", () => {
    // 21:30 UTC في يناير (UTC+2) → 23:30 القاهرة: نفس اليوم
    const nearMidnight = new Date("2026-01-15T21:30:00Z");
    expect(cairoDateString(nearMidnight)).toBe(expectedCairoDate(nearMidnight));
    expect(cairoDateString(nearMidnight)).toBe("2026-01-15");
    // 22:30 UTC → 00:30 القاهرة (اليوم التالي)
    const pastMidnight = new Date("2026-01-15T22:30:00Z");
    expect(cairoDateString(pastMidnight)).toBe("2026-01-16");
  });

  it("عبور الشهر: نهاية يناير تنتقل إلى فبراير بحسب القاهرة", () => {
    const d = new Date("2026-01-31T22:30:00Z"); // 00:30 القاهرة → فبراير
    expect(cairoDateString(d)).toBe(expectedCairoDate(d));
    expect(cairoDateString(d)).toBe("2026-02-01");
  });

  it("عبور السنة: ليلة رأس السنة تنتقل إلى 2026 في القاهرة", () => {
    const d = new Date("2025-12-31T22:30:00Z"); // 00:30 القاهرة → 2026
    expect(cairoDateString(d)).toBe(expectedCairoDate(d));
    expect(cairoDateString(d)).toBe("2026-01-01");
    // وفي الصيف (UTC+3): 21:30 UTC = 00:30 القاهرة — عبور أيضًا
    const summer = new Date("2026-07-31T21:30:00Z");
    expect(cairoDateString(summer)).toBe(expectedCairoDate(summer));
  });

  it("يوم التقارير: بداية اليوم (cairoDayStartUtc) تعود لنفس يوم القاهرة دائمًا", () => {
    for (const iso of ["2026-01-15T23:59:59Z", "2026-01-16T00:00:00Z", "2026-07-01T12:00:00Z", "2026-12-31T22:30:00Z"]) {
      const d = new Date(iso);
      const start = cairoDayStartUtc(d);
      expect(cairoDateString(start)).toBe(cairoDateString(d));
      expect(start.getTime()).toBeLessThanOrEqual(d.getTime()); // البداية لا تكون بعد اللحظة
    }
  });

  it("حدود DayStat: تاريخ القاهرة هو نفسه الذي يكتبه إنشاء الطلب وعدّاد الفتحات", () => {
    // السلوك القديم (نسخ ثلاث مكررة) يُنتج نفس الناتج — الآن مصدر واحد
    const d = new Date();
    expect(cairoDateString(d)).toBe(expectedCairoDate(d));
    // تطابق الناتج مع الصيغة التي كانت تستخدمها النسخ الثلاث حرفيًا (en-CA)
    const legacy = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    expect(cairoDateString(d)).toBe(legacy);
  });

  it("حد الصيانة: daysAgo يحسب بالضبط ناقص أيام", () => {
    const now = new Date("2026-08-14T00:00:00Z");
    expect(daysAgo(now, 30)).toEqual(new Date("2026-07-15T00:00:00Z"));
    expect(daysAgo(now, 0)).toEqual(now);
  });

  it("حالات حدية: 00:00:01 و23:59:59 في القاهرة تنتميان ليوميهما الصحيحين", () => {
    // شتاء (UTC+2): 22:00:01Z = 00:00:01 القاهرة — أول لحظة لليوم الجديد
    expect(cairoDateString(new Date("2026-01-15T22:00:01Z"))).toBe("2026-01-16");
    // 21:59:59Z = 23:59:59 القاهرة — آخر لحظة لليوم السابق
    expect(cairoDateString(new Date("2026-01-15T21:59:59Z"))).toBe("2026-01-15");
    // صيف (UTC+3): 21:00:01Z = 00:00:01 القاهرة
    expect(cairoDateString(new Date("2026-07-15T21:00:01Z"))).toBe("2026-07-16");
    expect(cairoDateString(new Date("2026-07-15T20:59:59Z"))).toBe("2026-07-15");
    // بداية اليوم: اللحظة قبل منتصف الليل بقاهرة تنتمي ليومها، وبعدها لليوم التالي
    const startOfJan15 = cairoDayStartUtc(new Date("2026-01-15T21:59:59Z"));
    expect(cairoDateString(startOfJan15)).toBe("2026-01-15");
    const startOfJan16 = cairoDayStartUtc(new Date("2026-01-15T22:00:01Z"));
    expect(cairoDateString(startOfJan16)).toBe("2026-01-16");
    expect(startOfJan16.getTime()).toBeGreaterThan(startOfJan15.getTime());
  });

  it("سنة كبيسة: 29 فبراير موجود في القاهرة وعبور منتصف الليل يعمل عبره", () => {
    // 2028 سنة كبيسة — 22:30Z في 28 فبراير = 00:30 القاهرة في 29 فبراير
    expect(cairoDateString(new Date("2028-02-28T22:30:00Z"))).toBe("2028-02-29");
    // ومنتصف ليلة 29 فبراير/1 مارس
    expect(cairoDateString(new Date("2028-02-29T22:30:00Z"))).toBe("2028-03-01");
    expect(cairoDateString(new Date("2028-02-29T12:00:00Z"))).toBe("2028-02-29");
  });
});