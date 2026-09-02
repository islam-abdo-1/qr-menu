import { describe, expect, it } from "vitest";
import { paymobSettlementDecision } from "@/lib/paymob";

const BASE = { currentStatus: "pending", success: true, pending: false, amountCents: 25000, expectedCents: 25000 };

describe("SEC-011: آلة قرار تسوية الدفع — الـ callback مصدر وحيد", () => {
  it("نجاح + مبلغ مطابق → pay (إتمام وتمديد)", () => {
    expect(paymobSettlementDecision({ ...BASE })).toEqual({ action: "pay" });
    expect(
      paymobSettlementDecision({ ...BASE, amountCents: 230000, expectedCents: 230000 }),
    ).toEqual({ action: "pay" });
  });

  it("replay بعد المعالجة (paid/failed) → ignore — لا اشتراك مزدوج مهما تكرر الـ callback", () => {
    expect(paymobSettlementDecision({ ...BASE, currentStatus: "paid" })).toEqual({ action: "ignore" });
    expect(paymobSettlementDecision({ ...BASE, currentStatus: "failed" })).toEqual({ action: "ignore" });
    // تكرار متوازٍ يصطدم بـ CAS — كلاهما يمر بالآلة: الأول pay والثاني ignore أو فشل الاستحواذ
  });

  it("حالة pending من البوابة → stay-pending (لا failed مبكرًا يضيّع المدفوع لاحقًا)", () => {
    expect(paymobSettlementDecision({ ...BASE, pending: true, success: false })).toEqual({
      action: "stay-pending",
    });
    // paymob يُرسل pending مع success=false أحيانًا — لا يُعلَّم نهائيًا إطلاقًا
    expect(paymobSettlementDecision({ ...BASE, pending: true })).toEqual({ action: "stay-pending" });
  });

  it("فشل/إلغاء/مبلغ مختلف → fail", () => {
    expect(paymobSettlementDecision({ ...BASE, success: false })).toEqual({ action: "fail" });
    expect(
      paymobSettlementDecision({ ...BASE, amountCents: 1, expectedCents: 25000 }),
    ).toEqual({ action: "fail" });
    // مبلغ أكبر من المتوقع (تلاعب/خطأ في الخطة) يرفض أيضًا
    expect(
      paymobSettlementDecision({ ...BASE, amountCents: 999999, expectedCents: 25000 }),
    ).toEqual({ action: "fail" });
  });

  it("الحسم الوحيد للتمديد هو النجاح المطابق — لا اعتماد على أي redirect", () => {
    const decisions = [
      { ...BASE, success: false },
      { ...BASE, pending: true },
      { ...BASE, amountCents: 0 },
      { ...BASE, currentStatus: "paid" },
      BASE,
    ].map((i) => paymobSettlementDecision(i));
    expect(decisions.filter((d) => d.action === "pay")).toHaveLength(1);
  });
});