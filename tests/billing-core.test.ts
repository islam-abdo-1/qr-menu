import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  ANNUAL_PRICE,
  MONTHLY_PRICE,
  PLAN_DAYS,
  TRIAL_DAYS,
  billingStatusOf,
  isBillingExpired,
  planDurationDays,
  planPrice,
  subscriptionEndAfter,
  toDate,
  trialDaysLeft,
  type BillingFields,
} from "@/lib/billing-core";

const NOW = new Date("2026-08-14T00:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");
const FUTURE = new Date("2026-12-01T00:00:00Z");

const r = (over: Partial<BillingFields> = {}): BillingFields => ({
  trialEndsAt: null,
  paidUntil: null,
  billingExempt: false,
  ...over,
});

describe("PHASE 5.3 — حالة الاشتراك: مصدر واحد صاحب سلطة", () => {
  it("اشتراك مدفوع نشط: active", () => {
    expect(billingStatusOf(r({ paidUntil: FUTURE }), true)).toBe("active");
  });

  it("اشتراك مدفوع منتهٍ: التجربة النشطة تلي الفترة المدفوعة ثم العكس (قاعدة قائمة محفوظة)", () => {
    // انتهى الدفع لكن التجربة ما زالت سارية → trial (يتبع الدفعَ أثرُه حتى نفاد التجربة)
    expect(billingStatusOf(r({ paidUntil: PAST, trialEndsAt: FUTURE }), true)).toBe("trial");
    // انتهى الدفع والتجربة معًا → expired
    expect(billingStatusOf(r({ paidUntil: PAST, trialEndsAt: PAST }), true)).toBe("expired");
  });

  it("تجربة نشطة: trial", () => {
    expect(billingStatusOf(r({ trialEndsAt: FUTURE }), true)).toBe("trial");
  });

  it("تجربة منتهية: expired", () => {
    expect(billingStatusOf(r({ trialEndsAt: PAST }), true)).toBe("expired");
  });

  it("مستثنى: exempt مهما كانت بقية الحقول وحالة البوابة", () => {
    expect(billingStatusOf(r({ billingExempt: true, paidUntil: PAST, trialEndsAt: PAST }), true)).toBe("exempt");
    expect(billingStatusOf(r({ billingExempt: true, paidUntil: null }), false)).toBe("exempt");
  });

  it("billingEnabled=false: لا قيود — active حتى مع انتهاء كل شيء", () => {
    expect(billingStatusOf(r({ paidUntil: PAST, trialEndsAt: PAST }), false)).toBe("active");
  });

  it("إلغاء الاشتراك = انتهاء paidUntil ثم transition للتجربة/الانتهاء", () => {
    // بعد إلغاء الدفع: لا paidUntil مستقبلي، بوابة مفعّلة، تجربة سابقة انتهت → expired
    expect(billingStatusOf(r({ paidUntil: null, trialEndsAt: PAST }), true)).toBe("expired");
  });

  it("isBillingExpired يتوافق مع الحالة وحدها", () => {
    expect(isBillingExpired({ status: "expired" })).toBe(true);
    expect(isBillingExpired({ status: "active" })).toBe(false);
    expect(isBillingExpired({ status: "trial" })).toBe(false);
    expect(isBillingExpired({ status: "exempt" })).toBe(false);
  });

  it("بلا تواريخ إطلاقًا (paidUntil/trialEndsAt مفقودان): expired مع بوابة مفعّلة", () => {
    expect(billingStatusOf(r(), true)).toBe("expired");
  });

  it("حدود اللحظة: المقارنة بالمللي ثانية الفاصلة — now+1ms نشط، now-1ms منتهٍ، الآن تمامًا منتهٍ (>)", () => {
    const nowMs = Date.now();
    const justAfter = new Date(nowMs + 1);
    const justBefore = new Date(nowMs - 1);
    expect(billingStatusOf(r({ paidUntil: justAfter }), true)).toBe("active");
    expect(billingStatusOf(r({ paidUntil: justBefore }), true)).toBe("expired");
    expect(billingStatusOf(r({ paidUntil: new Date(nowMs) }), true)).toBe("expired");
  });

  it("حياد المنطقة الزمنية: نفس المللي ثانية المطلقة تُعطي نفس القرار مهما شُيّد التاريخ", () => {
    const a = new Date("2026-12-01T00:00:00Z");
    const b = new Date(Date.UTC(2026, 11, 1, 0, 0, 0));
    expect(a.getTime()).toBe(b.getTime());
    expect(billingStatusOf(r({ paidUntil: a }), true)).toBe(billingStatusOf(r({ paidUntil: b }), true));
    expect(billingStatusOf(r({ paidUntil: a }), true)).toBe("active");
  });

  it("التواريخ نصية (تسلسل كاش) تُقبل كما هي — نفس القرار", () => {
    expect(billingStatusOf(r({ paidUntil: FUTURE.toISOString() }), true)).toBe("active");
    expect(billingStatusOf(r({ trialEndsAt: PAST.toISOString() }), true)).toBe("expired");
  });
});

describe("PHASE 5.3 — التجديد: المدد والأسعار وبدء من الانتهاء الحالي", () => {
  it("مدة الخطة: شهري 30 يومًا وسنوي 365 (كما كانت القاعدة في لوحة المالك)", () => {
    expect(planDurationDays("monthly")).toBe(30);
    expect(planDurationDays("annual")).toBe(365);
    expect(PLAN_DAYS).toEqual({ monthly: 30, annual: 365 });
  });

  it("الأسعار: 250 شهري / 2300 سنوي (كما كانت في التسجيل اليدوي)", () => {
    expect(planPrice("monthly")).toBe(MONTHLY_PRICE);
    expect(planPrice("annual")).toBe(ANNUAL_PRICE);
    expect(TRIAL_DAYS).toBe(7);
  });

  it("تجديد قبل الانتهاء: يبدأ من نهاية الفترة الحالية (لا تضييع)", () => {
    const end = subscriptionEndAfter(FUTURE, NOW, planDurationDays("monthly"));
    expect(end.getTime()).toBe(FUTURE.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("تجديد بعد الانتهاء: يبدأ من الآن (لا وقت منقضٍ)", () => {
    const end = subscriptionEndAfter(PAST, NOW, 30);
    expect(end.getTime()).toBe(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("بلا فترة سابقة: يبدأ من الآن", () => {
    const end = subscriptionEndAfter(null, NOW, TRIAL_DAYS);
    expect(end.getTime()).toBe(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
});

describe("PHASE 5.3 — الأدوات الداعمة", () => {
  it("trialDaysLeft: أيام متبقية مُقرّبة لأعلى وبلا سلبيات", () => {
    expect(trialDaysLeft(FUTURE)).toBeGreaterThan(100);
    expect(trialDaysLeft(PAST)).toBe(0);
    expect(trialDaysLeft(null)).toBe(0);
  });

  it("toDate: تطبيع أنواع التواريخ (دفاع كاش JSON/NFE)", () => {
    const d = new Date("2026-08-01T00:00:00Z");
    expect(toDate(d)?.getTime()).toBe(d.getTime());
    expect(toDate(d.toISOString())?.getTime()).toBe(d.getTime());
    expect(toDate(1782950400000)).toEqual(new Date(1782950400000));
    expect(toDate("")).toBeNull();
    expect(toDate(null)).toBeNull();
    expect(toDate("ليس تاريخًا")).toBeNull();
  });

  it("مزامنة النسختين: billing-core في qr-menu وowner-app متطابقان حرفيًا — مصدر واحد", () => {
    const a = readFileSync(new URL("../lib/billing-core.ts", import.meta.url), "utf8");
    const b = readFileSync(new URL("../../owner-app/lib/billing-core.ts", import.meta.url), "utf8");
    expect(a).toBe(b);
    expect(a).toContain("billingStatusOf");
    expect(b).toContain("billingStatusOf");
  });
});