import { describe, expect, it, vi } from "vitest";
import { requestMainSitePurge, buildPurgeUrl } from "../../owner-app/lib/purge";

const MAIN = "https://site-menu.ddnsfree.com";
const SECRET = "test-secret";

const res = (status: number, body = "") =>
  new Response(body, { status });

describe("SEC-013: تطهير كاش الموقع الرئيسي — استجابة مهلة وتسجيل", () => {
  it("استجابة غير ناجحة (401/500) تُرجع فشلًا بكود الاستجابة — بلا صمت", async () => {
    const fetchImpl = vi.fn(async () => res(401, "غير مصرح"));
    const r = await requestMainSitePurge({ secret: SECRET, mainUrl: MAIN, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(r.error).toContain("401");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // لا إعادة لخطأ 4xx
  });

  it("مهلة (AbortSignal) تُرجع فشلًا موثّقًا وتتوقف بعد عدد محدود من المحاولات", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new DOMException("The operation was aborted.", "AbortError")),
    );
    const r = await requestMainSitePurge({
      secret: SECRET,
      mainUrl: MAIN,
      fetchImpl,
      timeoutMs: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2); // محاولة + إعادة واحدة محدودة — بلا حلقات بلا نهاية
    expect(r.error?.toLowerCase()).toContain("abort");
  });

  it("فشل شبكة (ECONNREFUSED) يُعاد مرة واحدة وتُسجل النتيجة النهائية", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("fetch failed")));
    const r = await requestMainSitePurge({ secret: SECRET, mainUrl: MAIN, fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
    expect(r.error).toContain("fetch failed");
  });

  it("استجابة ناجحة 200 تُرجع ok مع عدد المحاولات", async () => {
    const fetchImpl = vi.fn(async () => res(200, "purged"));
    const r = await requestMainSitePurge({ secret: SECRET, mainUrl: MAIN, fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.attempts).toBe(1);
  });

  it("ينقل السر والـ slug في الطلب الصحيح", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      expect(body.secret).toBe(SECRET);
      expect(body.slug).toBe("kafy");
      return res(200);
    });
    const r = await requestMainSitePurge({ secret: SECRET, mainUrl: MAIN, slug: "kafy", fetchImpl });
    expect(r.ok).toBe(true);
  });

  it("ضبط URL التطهير بدون شرطة مكررة", () => {
    expect(buildPurgeUrl("https://x.com/")).toBe("https://x.com/api/purge");
    expect(buildPurgeUrl("https://x.com")).toBe("https://x.com/api/purge");
  });
});