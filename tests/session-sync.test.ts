import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

/**
 * PHASE 5.4 — المزامنة بين التطبيقين:
 * الوحدات النقية للجلسة (قراءة كوكي + فك JWT) مطابقة حرفيًا في qr-menu وowner-app —
 * التطبيقان مشروعا Vercel منفصلان، فالمصدر الواحد يُحفظ بنسختين متطابقتين
 * يفرض هذا الاختبار تطابقهما المستقبلي (لا انحراف صامت بين التطبيقين).
 */
describe("PHASE 5.4 — أدوات الجلسة: نسخة واحدة موثقة في التطبيقين", () => {
  it("session.ts متطابق حرفيًا بين qr-menu وowner-app", () => {
    const a = readFileSync(new URL("../lib/session.ts", import.meta.url), "utf8");
    const b = readFileSync(new URL("../../owner-app/lib/session.ts", import.meta.url), "utf8");
    expect(a).toBe(b);
    expect(a).toContain("hasValidSession");
  });

  it("session-cookies.ts متطابق حرفيًا بين qr-menu وowner-app (SEC-009)", () => {
    const a = readFileSync(new URL("../lib/session-cookies.ts", import.meta.url), "utf8");
    const b = readFileSync(new URL("../../owner-app/lib/session-cookies.ts", import.meta.url), "utf8");
    expect(a).toBe(b);
    expect(a).toContain("getSessionCookieOptions");
  });
});