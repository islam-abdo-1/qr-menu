import { describe, expect, it, vi, afterEach } from "vitest";

/**
 * PHASE 5.4 — حدود هوية مالك المنصة (owner-app):
 * getSuperAdmin يفصل كليًا بين مالك المنصة ومالكي المطاعم —
 * بريد ثابت SUPER_ADMIN_EMAIL، مقارنة غير حساسة للحالة، فشل مغلق.
 */

vi.mock("server-only", () => ({}));
vi.mock("../../owner-app/lib/supabase/server", () => ({
  getCurrentUser: vi.fn(),
}));

import { getSuperAdmin } from "../../owner-app/lib/super-admin";
import { getCurrentUser } from "../../owner-app/lib/supabase/server";

const getCurrentUserMock = vi.mocked(getCurrentUser);

afterEach(() => {
  vi.unstubAllEnvs();
  getCurrentUserMock.mockReset();
});

describe("PHASE 5.4 — مالك المنصة (Platform Admin)", () => {
  it("بريد مطابق تمامًا → هوية المالك (id + email)", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@example.com");
    getCurrentUserMock.mockResolvedValue({
      user: { id: "admin-1", email: "owner@example.com" },
    });
    expect(await getSuperAdmin()).toEqual({ id: "admin-1", email: "owner@example.com" });
  });

  it("غير حساس للحالة: Owner@Example.COM يطابق owner@example.com", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@example.com");
    getCurrentUserMock.mockResolvedValue({
      user: { id: "admin-1", email: "Owner@Example.COM" },
    });
    expect(await getSuperAdmin()).toEqual({ id: "admin-1", email: "Owner@Example.COM" });
  });

  it("بريد مختلف (مالك مطعم عادي) → null — لا وصول للمنصة", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@example.com");
    getCurrentUserMock.mockResolvedValue({
      user: { id: "rest-owner-1", email: "someone-else@example.com" },
    });
    expect(await getSuperAdmin()).toBeNull();
  });

  it("بلا جلسة / بلا بريد → null", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "owner@example.com");
    getCurrentUserMock.mockResolvedValue({ user: null });
    expect(await getSuperAdmin()).toBeNull();
    getCurrentUserMock.mockResolvedValue({ user: { id: "x", email: null } });
    expect(await getSuperAdmin()).toBeNull();
  });

  it("غياب SUPER_ADMIN_EMAIL → null (فشل مغلق — لا مشرف افتراضي)", async () => {
    vi.stubEnv("SUPER_ADMIN_EMAIL", "");
    getCurrentUserMock.mockResolvedValue({
      user: { id: "admin-1", email: "owner@example.com" },
    });
    expect(await getSuperAdmin()).toBeNull();
  });
});
