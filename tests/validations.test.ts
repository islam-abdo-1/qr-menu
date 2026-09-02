import { describe, expect, it } from "vitest";
import {
  credentialsSchema,
  imageUploadSchema,
  menuItemSchema,
  orderSchema,
  settingsSchema,
  signupSchema,
  staffLoginSchema,
  staffNameSchema,
} from "@/lib/validations";
import { cleanField, sanitizeText } from "@/lib/sanitize";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

function isOk(r: { success: boolean }): boolean {
  return r.success;
}

describe("PHASE 6.5 — مدخلات عدائية: رفض القيم الخبيثة/الفاسدة", () => {
  it("orderSchema: كميات سلبية/صفر/كسرية/ضخمة → رفض", () => {
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [{ itemId: "x", qty: 0 }] }))).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [{ itemId: "x", qty: -3 }] }))).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [{ itemId: "x", qty: 2.5 }] }))).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [{ itemId: "x", qty: 51 }] }))).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [{ itemId: "x", qty: 1 }] }))).toBe(true);
  });

  it("orderSchema: سلة فارغة / عدد أصناف مفرط / نوع غير صالح → رفض", () => {
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", items: [] }))).toBe(false);
    expect(
      isOk(
        orderSchema.safeParse({
          restaurantSlug: "kafy",
          customerName: "أ",
          type: "dine-in",
          items: Array.from({ length: 31 }, (_, i) => ({ itemId: `i${i}`, qty: 1 })),
        }),
      ),
    ).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "takeaway", items: [{ itemId: "x", qty: 1 }] }))).toBe(false);
  });

  it("orderSchema: cartNonce فاسد (أحرف ممنوعة/قصير/طويل) → رفض", () => {
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", cartNonce: "abc", items: [{ itemId: "x", qty: 1 }] }))).toBe(false);
    expect(isOk(orderSchema.safeParse({ restaurantSlug: "kafy", customerName: "أ", type: "dine-in", cartNonce: "<script>alert(1)</script>", items: [{ itemId: "x", qty: 1 }] }))).toBe(false);
    expect(
      isOk(
        orderSchema.safeParse({
          restaurantSlug: "kafy",
          customerName: "أ",
          type: "dine-in",
          cartNonce: "A".repeat(65),
          items: [{ itemId: "x", qty: 1 }],
        }),
      ),
    ).toBe(false);
  });

  it("orderSchema: حقول إضافية غير متوقعة تُقبل وتُتجاهل (لا تكسر) مع تطهير الحقول النصية", () => {
    const r = orderSchema.safeParse({
      restaurantSlug: "kafy<script>",
      customerName: "أنا<script>alert(1)</script>",
      type: "dine-in",
      items: [{ itemId: "x", qty: 1, price: 0.01 }],
      unexpectedField: { evil: true },
    });
    expect(isOk(r)).toBe(true);
    if (r.success) {
      expect(r.data.restaurantSlug).not.toContain("<script>");
      expect(r.data.customerName).not.toContain("<script>");
    }
  });

  it("menuItemSchema: أسعار سلبية/صفر/ضخمة/لانهائية/نصية → رفض", () => {
    const base = { name: "صنف", categoryId: "c1" };
    expect(isOk(menuItemSchema.safeParse({ ...base, price: -1 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, price: 0 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, price: 1_000_001 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, price: Infinity }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, price: NaN }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, price: "12.5" }))).toBe(true);
  });

  it("menuItemSchema: خصم خارج 0-100 / كسري / مقاسات زائدة / مقاس بسعر فاسد → رفض", () => {
    const base = { name: "صنف", categoryId: "c1", price: 10 };
    expect(isOk(menuItemSchema.safeParse({ ...base, discountPercentage: 101 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, discountPercentage: -1 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, discountPercentage: 1.5 }))).toBe(false);
    expect(
      isOk(
        menuItemSchema.safeParse({
          ...base,
          sizes: Array.from({ length: 9 }, (_, i) => ({ sizeCode: `S${i}`, price: 5 })),
        }),
      ),
    ).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ ...base, sizes: [{ sizeCode: "X", price: -5 }] }))).toBe(false);
  });

  it("menuItemSchema: اسم/وصف مفرط الطول → رفض؛ وسوم خبيثة تُطهر", () => {
    expect(isOk(menuItemSchema.safeParse({ name: "ن".repeat(121), categoryId: "c1", price: 5 }))).toBe(false);
    expect(isOk(menuItemSchema.safeParse({ name: "ن", categoryId: "c1", price: 5, description: "د".repeat(401) }))).toBe(false);
    const r = menuItemSchema.safeParse({ name: "<iframe src=x>حمص</iframe>", categoryId: "c1", price: 5 });
    expect(isOk(r)).toBe(true);
    if (r.success) expect(r.data.name).not.toContain("iframe");
  });

  it("credentialsSchema: بريد خبيث/مفرط وكلمات مرور قصيرة/طويلة → رفض", () => {
    expect(isOk(credentialsSchema.safeParse({ email: "a".repeat(300) + "@x.com", password: "pass1234" }))).toBe(false);
    expect(isOk(credentialsSchema.safeParse({ email: "not-an-email", password: "pass1234" }))).toBe(false);
    expect(isOk(credentialsSchema.safeParse({ email: "a@b.com", password: "short" }))).toBe(false);
    expect(isOk(credentialsSchema.safeParse({ email: "a@b.com", password: "p".repeat(73) }))).toBe(false);
    expect(isOk(credentialsSchema.safeParse({ email: "A@B.com", password: "pass1234" }))).toBe(true);
  });

  it("signupSchema: اسم مطعم بوسوم خبيثة → يُطهر؛ اسم 61 حرفًا → رفض", () => {
    const r = signupSchema.safeParse({ restaurantName: "عربي<script>X</script>", email: "a@b.com", password: "pass1234" });
    expect(isOk(r)).toBe(true);
    if (r.success) expect(r.data.restaurantName).not.toContain("script");
    expect(isOk(signupSchema.safeParse({ restaurantName: "ن".repeat(61), email: "a@b.com", password: "pass1234" }))).toBe(false);
  });

  it("imageUploadSchema: نوع غير صورة / حجم مفرط / اسم مفرط → رفض", () => {
    expect(isOk(imageUploadSchema.safeParse({ name: "x.png", size: 5, type: "text/html" }))).toBe(false);
    expect(isOk(imageUploadSchema.safeParse({ name: "x.png", size: 13 * 1024 * 1024, type: "image/png" }))).toBe(false);
    expect(isOk(imageUploadSchema.safeParse({ name: "n".repeat(256), size: 5, type: "image/png" }))).toBe(false);
  });

  it("staffLoginSchema: كود سري غير رقمي / طول خاطئ → رفض", () => {
    expect(isOk(staffLoginSchema.safeParse({ name: "أحمد", pin: "12a4" }))).toBe(false);
    expect(isOk(staffLoginSchema.safeParse({ name: "أحمد", pin: "123" }))).toBe(false);
    expect(isOk(staffLoginSchema.safeParse({ name: "أحمد", pin: "12345" }))).toBe(false);
    expect(isOk(staffLoginSchema.safeParse({ name: "أحمد", pin: "1234" }))).toBe(true);
  });

  it("settingsSchema: عملة خاطئة / لون غير صالح → رفض؛ اسم مطعم خبيث يُطهر", () => {
    expect(isOk(settingsSchema.safeParse({ restaurantName: "م", currency: "US" }))).toBe(false);
    expect(isOk(settingsSchema.safeParse({ restaurantName: "م", currency: "USD", themePrimary: "red" }))).toBe(false);
    expect(isOk(settingsSchema.safeParse({ restaurantName: "م", currency: "USD", themePrimary: "#GGGGGG" }))).toBe(false);
    const r = settingsSchema.safeParse({ restaurantName: "<form>مطعمي</form>", currency: "usd" });
    expect(isOk(r)).toBe(true);
    if (r.success) {
      expect(r.data.restaurantName).not.toContain("form");
      expect(r.data.currency).toBe("USD");
    }
  });

  it("unicode/hidden edge: أحرف تحكم تُطهر؛ نصوص عربية/رموز تعبيرية تبقى سليمة", () => {
    const r = staffNameSchema.safeParse({ name: "محمد\u0000\u0007\u001F\u007F🙂" });
    expect(isOk(r)).toBe(true);
    if (r.success) expect(r.data.name).toBe("محمد🙂");
  });
});

describe("PHASE 6.6 — تعقيم XSS: إزالة الوسوم الخطرة + تفلت React كطبقة ثانية", () => {
  it("sanitizeText يزيل وسم script بمتغيراته (مصفوفة، أحرف بداخله، حالة مختلفة)", () => {
    expect(sanitizeText("<script>alert(1)</script>")).toBe("alert(1)");
    expect(sanitizeText('<SCRIPT SRC="//evil/x.js"></SCRIPT>')).toBe("");
    expect(sanitizeText('<script src=https://evil/x.js></script>')).toBe("");
    expect(sanitizeText(' قبل <script >alert(1)</script> بعد ')).toBe("قبل alert(1) بعد");
  });

  it("sanitizeText يزيل iframe/object/embed/form — يبقى محتوى الوسم فقط", () => {
    expect(sanitizeText('<iframe src="https://evil"></iframe>')).toBe("");
    expect(sanitizeText('<object data="x">صندوق</object>')).toBe("صندوق");
    expect(sanitizeText('<embed src="x">')).toBe("");
    expect(sanitizeText('<form action="phish"><input></form>')).toBe("<input>");
    expect(sanitizeText('<iframe src=x>')).toBe("");
  });

  it("sanitizeText يزيل أحرف التحكم ويقليص المسافات المتكررة", () => {
    expect(sanitizeText("a\u0000\u001Fb")).toBe("ab");
    expect(sanitizeText("أ    ب")).toBe("أ ب");
    expect(sanitizeText("  x  ")).toBe("x");
  });

  it("cleanField يقصّ إلى 500 حرف", () => {
    expect(cleanField("x".repeat(900))).toHaveLength(500);
  });

  it("طبقة الدفاع الثانية: React يفلت HTML تلقائيًا — ما فات التطهير لا ينفذ", () => {
    const hostile = sanitizeText("a<sc ript>alert(1)</sc ript>b"); // obfuscation: فات التطهير
    const html = renderToStaticMarkup(createElement("span", null, hostile));
    expect(html).not.toContain("<sc ript>alert");
    expect(html).toContain("&lt;");
    const escaped = renderToStaticMarkup(
      createElement("div", null, "<img src=x onerror=alert(1)>"),
    );
    expect(escaped).not.toContain("<img");
  });
});