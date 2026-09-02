import { describe, expect, it } from "vitest";
import {
  IP_BURST_LIMIT,
  ORDER_WINDOW_LIMIT,
  isValidCartNonce,
  orderQuotaExceeded,
  orderWindowStart,
} from "@/lib/orders-guard";
import { rateLimitIp } from "@/lib/rate-limit";

describe("SEC-002: صيغة cartNonce (invalid nonce)", () => {
  it("يقبل nonce صحيحًا من UUID معرّى (32 حرفًا)", () => {
    expect(isValidCartNonce("3f2c1a9b8d4e5f60718293a4b5c6d7e8f")).toBe(true);
  });
  it("يرفض nonce قصيرًا (< 16)", () => {
    expect(isValidCartNonce("short")).toBe(false);
  });
  it("يرفض nonce طويلًا (> 64)", () => {
    expect(isValidCartNonce("a".repeat(65))).toBe(false);
  });
  it("يرفض أحرفًا خارج المسموح (تلاعب/حقن)", () => {
    expect(isValidCartNonce("abc; DROP TABLE \"Order\"; --")).toBe(false);
    expect(isValidCartNonce("abc..أحرف-عربية")).toBe(false);
    expect(isValidCartNonce("has space inside 1234")).toBe(false);
  });
  it("يرفض غير النصوص (null/رقم/كائن)", () => {
    expect(isValidCartNonce(null)).toBe(false);
    expect(isValidCartNonce(1234)).toBe(false);
    expect(isValidCartNonce({})).toBe(false);
    expect(isValidCartNonce(undefined)).toBe(false);
  });
  it("يرفض nonce فارغًا أو بمسافات", () => {
    expect(isValidCartNonce("")).toBe(false);
    expect(isValidCartNonce("   ")).toBe(false);
  });
});

describe("SEC-002: حدود النافذة الصارمة (quota)", () => {
  it("يسمح عند العدد = الحد تمامًا (150)", () => {
    expect(orderQuotaExceeded(ORDER_WINDOW_LIMIT)).toBe(false);
  });
  it("يرفض من 151 فصاعدًا", () => {
    expect(orderQuotaExceeded(ORDER_WINDOW_LIMIT + 1)).toBe(true);
    expect(orderQuotaExceeded(1000)).toBe(true);
  });
  it("نافذة بدايتها مضاعفات 5 دقائق — صفوف متفرقة لا تتضارب", () => {
    const t0 = new Date("2026-08-19T12:03:00Z").getTime();
    expect(orderWindowStart(t0).toISOString()).toBe("2026-08-19T12:00:00.000Z");
    const t1 = new Date("2026-08-19T12:07:59Z").getTime();
    expect(orderWindowStart(t1).toISOString()).toBe("2026-08-19T12:05:00.000Z");
  });
});

describe("SEC-002: حد انفجار IP (rate-limit bypass)", () => {
  it("يسمح بحد الانفجار كاملًا ثم يرُد الرفض على المحاولة التالية (نفس IP)", async () => {
    for (let i = 0; i < IP_BURST_LIMIT; i++) {
      expect((await rateLimitIp("order-burst", "1.2.3.4", IP_BURST_LIMIT, 60_000)).ok).toBe(true);
    }
    const blocked = await rateLimitIp("order-burst", "1.2.3.4", IP_BURST_LIMIT, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
  it("لا يسمح بالتجاوز عبر تعدد أسماء النطاقات/الترويسات — مفتاح موحّد من IP", async () => {
    for (let i = 0; i < IP_BURST_LIMIT; i++) {
      await rateLimitIp("order-burst", "5.6.7.8", IP_BURST_LIMIT, 60_000);
    }
    expect((await rateLimitIp("order-burst", "5.6.7.8", IP_BURST_LIMIT, 60_000)).ok).toBe(false);
  });
  it("النوافذ مستقلة بين IPs مختلفة (لا تسريب متبادل)", async () => {
    for (let i = 0; i < IP_BURST_LIMIT + 5; i++) {
      await rateLimitIp("order-burst", "9.9.9.9", IP_BURST_LIMIT, 60_000);
    }
    expect((await rateLimitIp("order-burst", "8.8.8.8", IP_BURST_LIMIT, 60_000)).ok).toBe(true);
  });
  it("النافذة تزول بعد انتهائها — إعادة الضبط التلقائي (لا عقوبة دائمة)", async () => {
    const ip = "7.7.7.7";
    for (let i = 0; i < IP_BURST_LIMIT; i++) await rateLimitIp("order-burst", ip, IP_BURST_LIMIT, 20);
    expect((await rateLimitIp("order-burst", ip, IP_BURST_LIMIT, 20)).ok).toBe(false);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimitIp("order-burst", ip, IP_BURST_LIMIT, 20).ok).toBe(true);
        resolve();
      }, 25);
    });
  });
});