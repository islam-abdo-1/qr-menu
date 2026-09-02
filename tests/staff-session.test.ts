import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** مخزن كوكيز وهمي — يحاكي next/headers خارج بيئة Next */
const store = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (store.has(n) ? { name: n, value: store.get(n)! } : undefined),
    set: (n: string, v: string) => {
      store.set(n, v);
    },
    delete: (n: string) => {
      store.delete(n);
    },
  }),
}));

import { clearStaffSession, getStaffSession, setStaffSession } from "@/lib/staff-session";

const PRIMARY = "test-primary-secret-0123456789abcdef";
const LEGACY = "test-legacy-service-role-key-0123456789";

beforeEach(() => {
  store.clear();
  process.env.STAFF_SESSION_SECRET = PRIMARY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LEGACY;
});

afterEach(() => {
  delete process.env.STAFF_SESSION_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

/** توقيع يدوي بالنمط القديم (ما كان يصدره الإصدار السابق) */
function legacyToken(slug: string, name: string, expires: number): string {
  const payload = Buffer.from(JSON.stringify({ slug, name, expires })).toString("base64url");
  const sig = createHmac("sha256", LEGACY).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

describe("SEC-007: فصل سر جلسات الموظفين", () => {
  it("التوقيع الجديد يتم بـ STAFF_SESSION_SECRET فقط (لا يُلمس سر القاعدة)", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "should-not-be-used-for-signing";
    await setStaffSession({ slug: "kafy", name: "م. أحمد" }, false);
    const stored = store.get("staff-auth")!;
    const sig = stored.split(".")[1];
    const expected = createHmac("sha256", PRIMARY).update(stored.split(".")[0]).digest("hex");
    expect(sig).toBe(expected);
    expect(await getStaffSession()).toEqual({ slug: "kafy", name: "م. أحمد" });
  });

  it("كوكيز الجلسات القديمة (الموقعة بسلف service-role) تُقبل ضمن نافذة التوافق 30 يومًا", async () => {
    store.set("staff-auth", legacyToken("kafy", "م. أحمد", Date.now() + 60_000));
    // حتى مع وجود المفتاح الجديد — السلف يمرر الجلسة القائمة بلا إسقاط
    expect(await getStaffSession()).toEqual({ slug: "kafy", name: "م. أحمد" });
  });

  it("كوكي قديم بسلف متغيّر/فاسد يُرفض", async () => {
    const parts = legacyToken("kafy", "م. أحمد", Date.now() + 60_000).split(".");
    const payload = parts[0];
    const badSig = createHmac("sha256", "wrong-legacy-key").update(payload).digest("hex");
    store.set("staff-auth", `${payload}.${badSig}`);
    expect(await getStaffSession()).toBeNull();
  });

  it("عبث بالحمولة أو التوقيع → رفض (لا توجد جلسة)", async () => {
    await setStaffSession({ slug: "kafy", name: "م. أحمد" }, false);
    const [payload] = store.get("staff-auth")!.split(".");
    store.set("staff-auth", `${payload}.tampered`);
    expect(await getStaffSession()).toBeNull();
    store.set("staff-auth", `${payload}TOTAL.b0gussig`);
    expect(await getStaffSession()).toBeNull();
  });

  it("جلسة منتهية → null (حتى بتوقيع سليم)", async () => {
    store.set("staff-auth", legacyToken("kafy", "م. أحمد", Date.now() - 1000));
    expect(await getStaffSession()).toBeNull();
  });

  it("صيغة فاسدة (جزء واحد) → null", async () => {
    store.set("staff-auth", "only-one-part");
    expect(await getStaffSession()).toBeNull();
  });

  it("غياب STAFF_SESSION_SECRET → فشل مغلق: لا توقيع جديد ولا جلسة", async () => {
    delete process.env.STAFF_SESSION_SECRET;
    await expect(setStaffSession({ slug: "kafy", name: "م. أحمد" }, false)).rejects.toThrow();
    expect(await getStaffSession()).toBeNull();
  });

  it("قيمة وهمية (placeholder) تُعامل كغياب — فشل مغلق", async () => {
    process.env.STAFF_SESSION_SECRET = "your-staff-session-secret";
    await expect(setStaffSession({ slug: "kafy", name: "م. أحمد" }, false)).rejects.toThrow();
    expect(await getStaffSession()).toBeNull();
  });

  it("بدون أي مفتاح إطلاقًا → null (لا جلسة ولا خطأ إجرائي)", async () => {
    delete process.env.STAFF_SESSION_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(await getStaffSession()).toBeNull();
  });
});