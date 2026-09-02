import { describe, expect, it } from "vitest";
import {
  DEMO_ORDER_MESSAGE,
  DEMO_SLUG,
  DEMO_STAFF_MESSAGE,
  demoOrderAllowed,
  demoStaffLoginAllowed,
  isDemoSlug,
} from "@/lib/demo";

describe("SEC-004: public demo sandbox identity", () => {
  it("يعرّف المستأجر التجريبي بالـ slug فقط", () => {
    expect(isDemoSlug(DEMO_SLUG)).toBe(true);
    expect(isDemoSlug("kafy")).toBe(false);
    expect(isDemoSlug("")).toBe(false);
    expect(isDemoSlug(undefined)).toBe(false);
    expect(isDemoSlug(null)).toBe(false);
  });

  it("رفض طلبات العرض التجريبي صارم وغير قابل للتجاوز", () => {
    expect(demoOrderAllowed(DEMO_SLUG)).toBe(false);
    expect(demoOrderAllowed("kafy")).toBe(true);
    expect(demoOrderAllowed(undefined)).toBe(true);
  });

  it("رفض دخول موظفين على العرض التجريبي — بلا تمييز", () => {
    expect(demoStaffLoginAllowed(DEMO_SLUG)).toBe(false);
    expect(demoStaffLoginAllowed("kafy")).toBe(true);
    expect(DEMO_STAFF_MESSAGE.length).toBeGreaterThan(0);
    expect(DEMO_ORDER_MESSAGE.length).toBeGreaterThan(0);
  });
});