import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";

describe("PHASE 6.12 — حد المعدل: انفجارات IP داخل النافذة توقَّف", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("الحد مكسور بعد التجاوز → retryAfterSeconds موجب، والنافذة تُعاد بعد انقضائها", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => rateLimitIp("o", "1.2.3.4", 5, 10_000)));
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results[5].ok).toBe(false);
    expect(results[5].retryAfterSeconds).toBeGreaterThan(0);
    expect(results[5].retryAfterSeconds).toBeLessThanOrEqual(10);

    vi.advanceTimersByTime(10_001);
    const after = await rateLimitIp("o", "1.2.3.4", 5, 10_000);
    expect(after.ok).toBe(true);
    expect(after.retryAfterSeconds).toBe(0);
  });

  it("عناوين IP مختلفة مستقلة (لا يدفع أحد عن الآخر)", async () => {
    for (let i = 0; i < 5; i++) await rateLimitIp("o", "10.0.0.1", 5, 10_000);
    expect((await rateLimitIp("o", "10.0.0.2", 5, 10_000)).ok).toBe(true);
    expect((await rateLimitIp("o", "10.0.0.1", 5, 10_000)).ok).toBe(false);
  });

  it("مفاتيح بادئة مختلفة مستقلة (الطلبات ≠ المصادقة)", async () => {
    for (let i = 0; i < 5; i++) await rateLimitIp("orders", "10.0.0.9", 5, 10_000);
    expect((await rateLimitIp("auth", "10.0.0.9", 5, 10_000)).ok).toBe(true);
  });

  it("استخراج IP من الترويسات: cf-connecting-ip ثم x-real-ip ثم أول x-forwarded-for ثم unknown", async () => {
    const mk = (headers: Record<string, string>) => new Request("http://x", { headers });
    expect((await rateLimit("k", mk({ "cf-connecting-ip": "8.8.8.8" }), 1, 1000)).ok).toBe(true);
    expect((await rateLimit("k", mk({ "x-real-ip": "9.9.9.9" }), 1, 1000)).ok).toBe(true);
    expect((await rateLimit("k", mk({ "x-forwarded-for": "7.7.7.7, 8.8.8.8" }), 1, 1000)).ok).toBe(true);
    expect((await rateLimit("k", new Request("http://x"), 1, 1000)).ok).toBe(true);
  });

  it("مقاومة التضخم: >2000 مفتاح لا يكسر الحارس؛ المنتهي يُنظَّف وتُعاد نافذته", async () => {
    for (let i = 0; i < 2010; i++) await rateLimitIp("sweep", `192.168.${i >> 8}.${i & 255}`, 1, 10_000);
    expect((await rateLimitIp("sweep", "192.168.100.100", 1, 10_000)).ok).toBe(true);
    expect((await rateLimitIp("sweep", "192.168.100.100", 1, 10_000)).ok).toBe(false);
    vi.advanceTimersByTime(10_001);
    expect((await rateLimitIp("sweep", "192.168.100.100", 1, 10_000)).ok).toBe(true);
    expect((await rateLimitIp("fresh", "5.5.5.5", 1, 10_000)).ok).toBe(true);
  });
});