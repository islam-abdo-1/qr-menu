import { describe, it, expect } from "vitest";
import { formatPrice, applyDiscount, cn, isValidPhone, toImageProxyUrl } from "@/lib/utils";

describe("utils - formatPrice", () => {
  it("formats EGP correctly in Arabic", () => {
    expect(formatPrice(100, "EGP", "ar")).toBe("١٠٠ ج.م");
    expect(formatPrice(50.5, "EGP", "ar")).toBe("٥٠٫٥ ج.م");
    expect(formatPrice(0, "EGP", "ar")).toBe("٠ ج.م");
  });

  it("formats EGP correctly in English", () => {
    expect(formatPrice(100, "EGP", "en")).toBe("100 ج.م");
    expect(formatPrice(50.5, "EGP", "en")).toBe("50.5 ج.م");
  });

  it("formats SAR correctly", () => {
    expect(formatPrice(100, "SAR", "ar")).toBe("١٠٠ ر.س");
    expect(formatPrice(100, "SAR", "en")).toBe("100 ر.س");
  });

  it("formats USD correctly", () => {
    expect(formatPrice(100, "USD", "ar")).toBe("١٠٠ USD");
    expect(formatPrice(100, "USD", "en")).toBe("100 USD");
  });

  it("handles large numbers with grouping", () => {
    expect(formatPrice(1000000, "EGP", "ar")).toBe("١٬٠٠٠٬٠٠٠ ج.م");
    expect(formatPrice(1000000, "EGP", "en")).toBe("1,000,000 ج.م");
  });

  it("handles unknown currency", () => {
    expect(formatPrice(100, "XYZ", "ar")).toBe("١٠٠ XYZ");
  });
});

describe("utils - applyDiscount", () => {
  it("applies percentage discount correctly", () => {
    expect(applyDiscount(100, 10)).toBe(90);
    expect(applyDiscount(100, 25)).toBe(75);
    expect(applyDiscount(100, 50)).toBe(50);
    expect(applyDiscount(100, 100)).toBe(0);
  });

  it("returns original price for 0 or null discount", () => {
    expect(applyDiscount(100, 0)).toBe(100);
    expect(applyDiscount(100, null)).toBe(100);
    expect(applyDiscount(100, undefined)).toBe(100);
  });

  it("handles decimal prices", () => {
    expect(applyDiscount(99.99, 10)).toBeCloseTo(89.99, 2);
  });

  it("handles edge cases", () => {
    expect(applyDiscount(0, 50)).toBe(0);
    expect(applyDiscount(-100, 10)).toBe(-90);
  });

  it("clamps discount to 0-100 range", () => {
    expect(applyDiscount(100, -10)).toBe(100);
    expect(applyDiscount(100, 150)).toBe(0);
  });
});

describe("utils - cn (classnames utility)", () => {
  it("joins class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("handles conditional classes", () => {
    expect(cn("base", true && "conditional")).toBe("base conditional");
    expect(cn("base", false && "conditional")).toBe("base");
    expect(cn("base", null, undefined, "valid")).toBe("base valid");
  });

  it("handles object syntax", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
    expect(cn({ active: false, disabled: true })).toBe("disabled");
  });
});

describe("utils - isValidPhone", () => {
  it("validates Egyptian mobile numbers", () => {
    expect(isValidPhone("01012345678")).toBe(true);
    expect(isValidPhone("01112345678")).toBe(true);
    expect(isValidPhone("01212345678")).toBe(true);
    expect(isValidPhone("01512345678")).toBe(true);
  });

  it("validates Egyptian numbers with country code", () => {
    expect(isValidPhone("+201012345678")).toBe(true);
    expect(isValidPhone("00201012345678")).toBe(true);
  });

  it("validates international format", () => {
    expect(isValidPhone("+1234567890")).toBe(true);
    expect(isValidPhone("+447911123456")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidPhone("0101234567")).toBe(false); // too short
    expect(isValidPhone("010123456789")).toBe(false); // too long
    expect(isValidPhone("02012345678")).toBe(false); // landline
    expect(isValidPhone("1234567890")).toBe(false); // no prefix
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });

  it("accepts numbers with spaces and dashes", () => {
    expect(isValidPhone("010 1234 5678")).toBe(true);
    expect(isValidPhone("010-1234-5678")).toBe(true);
    expect(isValidPhone("+20 10 1234 5678")).toBe(true);
  });
});

describe("utils - toImageProxyUrl", () => {
  it("generates correct proxy URL with custom options", () => {
    const url = "https://supabase.co/storage/v1/object/public/images/logo.png";
    const result = toImageProxyUrl(url, { width: 400, quality: 75 });
    expect(result).toBe("/api/image?url=https%3A%2F%2Fsupabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fimages%2Flogo.png&w=400&q=75");
  });

  it("accepts custom width and quality", () => {
    const url = "https://supabase.co/img.jpg";
    const result = toImageProxyUrl(url, { width: 800, quality: 90 });
    expect(result).toContain("w=800");
    expect(result).toContain("q=90");
  });

  it("returns undefined for empty string", () => {
    expect(toImageProxyUrl("")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(toImageProxyUrl(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(toImageProxyUrl(undefined)).toBeUndefined();
  });

  it("returns original URL if already proxied", () => {
    const url = "/api/image?url=test&w=400";
    expect(toImageProxyUrl(url)).toBe(url);
  });

  it("returns original URL if not Supabase", () => {
    const url = "https://example.com/image.jpg";
    expect(toImageProxyUrl(url)).toBe(url);
  });

  it("handles Supabase Storage URLs correctly", () => {
    const urls = [
      "https://chczpvevpfqiyvfwjbro.supabase.co/storage/v1/object/public/menu/image.png",
      "https://supabase.in/storage/v1/object/public/menu/image.jpg",
      "https://supabase.net/storage/v1/object/public/menu/image.webp",
    ];
    urls.forEach(url => {
      const result = toImageProxyUrl(url, { width: 400, quality: 75 });
      expect(result).toContain("/api/image?url=");
      expect(result).toContain("w=400");
      expect(result).toContain("q=75");
    });
  });

  it("includes height when provided", () => {
    const url = "https://supabase.co/img.jpg";
    const result = toImageProxyUrl(url, { width: 400, height: 300 });
    expect(result).toContain("w=400");
    expect(result).toContain("h=300");
  });

  it("includes format when provided", () => {
    const url = "https://supabase.co/img.jpg";
    const result = toImageProxyUrl(url, { format: "avif" });
    expect(result).toContain("f=avif");
  });
});