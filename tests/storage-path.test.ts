import { describe, expect, it } from "vitest";
import { imagePathFromUrl, isTenantOwnedPath } from "@/lib/supabase/storage";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("SEC-016 — ملكية ملفات Storage: لا حذف عبر-المستأجرين (F-2)", () => {
  it("مسار منسوب لذات المستأجر قابل للحذف (items + logo)", () => {
    expect(isTenantOwnedPath(`items/${A}/abc.webp`, A)).toBe(true);
    expect(isTenantOwnedPath(`logo/${A}/abc.webp`, A)).toBe(true);
    expect(isTenantOwnedPath(`items/${A}/x/y.webp`, A)).toBe(true);
  });

  it("مسار مستأجر آخر يُرفض للحذف — حتى لو مطابقًا لبادئة خاطئة", () => {
    expect(isTenantOwnedPath(`items/${B}/abc.webp`, A)).toBe(false);
    expect(isTenantOwnedPath(`logo/${B}/abc.webp`, A)).toBe(false);
  });

  it("المسارات المتوارثة بلا بادئة مستأجر (قبل الإصلاح) تُرفض للحذف — أمان قبل التنظيف", () => {
    expect(isTenantOwnedPath("items/abc-uuid.webp", A)).toBe(false);
    expect(isTenantOwnedPath("logo/abc-uuid.webp", A)).toBe(false);
  });

  it("روابط URL كاملة تُفهم من المسار الداخلي وتحكم نفس القاعدة", () => {
    const urlA = `https://x.supabase.co/storage/v1/object/public/menu-images/items/${A}/x.webp`;
    expect(isTenantOwnedPath(urlA, A)).toBe(true);
    const urlB = `https://x.supabase.co/storage/v1/object/public/menu-images/items/${B}/x.webp`;
    expect(isTenantOwnedPath(urlB, A)).toBe(false);
  });

  it("قيم فارغة/روابط خارجية/مسارات معطوبة تُرفض دائمًا (فشل-مغلق)", () => {
    expect(isTenantOwnedPath(null, A)).toBe(false);
    expect(isTenantOwnedPath(undefined, A)).toBe(false);
    expect(isTenantOwnedPath("", A)).toBe(false);
    expect(isTenantOwnedPath("https://evil.com/x.png", A)).toBe(false);
    expect(isTenantOwnedPath("..%2f..%2fetc/passwd", A)).toBe(false);
    expect(isTenantOwnedPath(`items/${A}`, A)).toBe(false); // بلا شرطة نهائية
    expect(isTenantOwnedPath(`items/${A}`, "")).toBe(false);
  });

  it("imagePathFromUrl يستخرج المسار من الرابط الكامل فقط داخل الـ bucket", () => {
    expect(imagePathFromUrl(`https://x.supabase.co/storage/v1/object/public/menu-images/items/${A}/x.webp`)).toBe(`items/${A}/x.webp`);
    expect(imagePathFromUrl(`items/${A}/x.webp`)).toBe(`items/${A}/x.webp`);
    expect(imagePathFromUrl("https://evil.com/x.png")).toBe("https://evil.com/x.png");
  });
});