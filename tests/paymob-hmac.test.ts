import { describe, expect, it, vi, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifyPaymobSignature, safeHmacEqual } from "@/lib/paymob";

afterEach(() => {
  vi.unstubAllEnvs();
});

const SECRET = "sec010-test-secret";
const OBJ = {
  amount_cents: "25000",
  created_at: "2026-08-14T00:00:00.000000",
  currency: "EGP",
  success: "true",
  order: "12345",
};

// حساب بالترتيب الصحيح نفسه المستخدم في lib/paymob.ts (HMAC_FIELDS)
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occurred", "has_ssl",
  "integration_id", "is_3d_secure", "is_auth", "is_capture", "is_refunded",
  "is_standalone_payment", "is_voided", "order", "owner", "pending",
  "source_data_pan", "source_data_sub_type", "source_data_type", "success",
  "token", "txn_response_codes",
];
function realHmac(obj: Record<string, unknown>): string {
  const text = HMAC_FIELDS.map((f) => String(obj[f] ?? "")).join("|");
  return createHmac("sha512", SECRET).update(text).digest("hex");
}

describe("SEC-010: مقارنة HMAC بثبات زمني", () => {
  it("الـ HMAC الصحيح مقبول", () => {
    vi.stubEnv("PAYMOB_HMAC_SECRET", SECRET);
    expect(verifyPaymobSignature(OBJ, realHmac(OBJ))).toBe(true);
  });

  it("HMAC معدَّل (حرف واحد) مرفوض", () => {
    vi.stubEnv("PAYMOB_HMAC_SECRET", SECRET);
    const good = realHmac(OBJ);
    const mutated = (good[0] === "a" ? "b" : "a") + good.slice(1);
    expect(verifyPaymobSignature(OBJ, mutated)).toBe(false);
  });

  it("اختلاف طول (اقتطاع/تذييل) مرفوض بأمان", () => {
    vi.stubEnv("PAYMOB_HMAC_SECRET", SECRET);
    const good = realHmac(OBJ);
    expect(verifyPaymobSignature(OBJ, good.slice(0, 40))).toBe(false);
    expect(verifyPaymobSignature(OBJ, good + "00")).toBe(false);
  });

  it("غياب السر أو الـ HMAC → رفض تلقائي", () => {
    vi.stubEnv("PAYMOB_HMAC_SECRET", "");
    expect(verifyPaymobSignature(OBJ, realHmac(OBJ))).toBe(false);
    vi.stubEnv("PAYMOB_HMAC_SECRET", SECRET);
    expect(verifyPaymobSignature(OBJ, undefined)).toBe(false);
  });

  it("safeHmacEqual يستخدم مقارنة متساوية الطول ويرفض فروق الطول", () => {
    expect(safeHmacEqual("abcd", "abcd")).toBe(true);
    expect(safeHmacEqual("abcd", "abce")).toBe(false);
    expect(safeHmacEqual("abcd", "abc")).toBe(false);
    expect(safeHmacEqual("abc", "abcd")).toBe(false);
  });
});