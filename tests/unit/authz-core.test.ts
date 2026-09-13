import { describe, it, expect } from "vitest";
import {
  ownerAccessGate,
  menuEditorGate,
  staffAccessGate,
  ownerAccessMessage,
  staffAccessMessage,
  type RestaurantLike,
  type StaffSessionLike,
  type GateSources,
  type StaffGateSources,
} from "@/lib/authz-core";

const mockRestaurant: RestaurantLike = {
  id: "rest-1",
  slug: "test-restaurant",
  name: "Test Restaurant",
  blocked: false,
  trialEndsAt: null,
  paidUntil: null,
  billingExempt: false,
};

const mockStaffSession: StaffSessionLike = {
  slug: "test-restaurant",
  name: "Ahmed",
};

const mockGateSources: GateSources = {
  ownerRestaurant: async () => mockRestaurant,
  subscriptionExpired: async () => false,
};

const mockStaffGateSources: StaffGateSources = {
  staffSession: async () => mockStaffSession,
  restaurantBySlug: async () => mockRestaurant,
  subscriptionExpired: async () => false,
};

describe("authz-core - Owner Access Gates", () => {
  it("ownerAccessGate returns ok for valid restaurant with active subscription", async () => {
    const result = await ownerAccessGate(mockGateSources);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.restaurant.id).toBe("rest-1");
      expect(result.restaurant.slug).toBe("test-restaurant");
    }
  });

  it("ownerAccessGate returns unauthorized when restaurant not found", async () => {
    const sources: GateSources = {
      ownerRestaurant: async () => null,
      subscriptionExpired: async () => false,
    };
    const result = await ownerAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unauthorized");
    }
  });

  it("ownerAccessGate returns billing-expired when subscription expired", async () => {
    const sources: GateSources = {
      ownerRestaurant: async () => mockRestaurant,
      subscriptionExpired: async () => true,
    };
    const result = await ownerAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("billing-expired");
    }
  });
});

describe("authz-core - Menu Editor Gate", () => {
  it("menuEditorGate returns ok for valid restaurant with active subscription and not blocked", async () => {
    const result = await menuEditorGate(mockGateSources);
    expect(result.ok).toBe(true);
  });

  it("menuEditorGate returns false for blocked restaurant", async () => {
    const sources: GateSources = {
      ownerRestaurant: async () => ({ ...mockRestaurant, blocked: true }),
      subscriptionExpired: async () => false,
    };
    const result = await menuEditorGate(sources);
    expect(result.ok).toBe(false);
  });

  it("menuEditorGate returns false for expired subscription", async () => {
    const sources: GateSources = {
      ownerRestaurant: async () => mockRestaurant,
      subscriptionExpired: async () => true,
    };
    const result = await menuEditorGate(sources);
    expect(result.ok).toBe(false);
  });

  it("menuEditorGate returns false for unauthorized", async () => {
    const sources: GateSources = {
      ownerRestaurant: async () => null,
      subscriptionExpired: async () => false,
    };
    const result = await menuEditorGate(sources);
    expect(result.ok).toBe(false);
  });
});

describe("authz-core - Staff Access Gate", () => {
  it("staffAccessGate returns ok for valid session and restaurant", async () => {
    const result = await staffAccessGate(mockStaffGateSources);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.name).toBe("Ahmed");
      expect(result.restaurant.id).toBe("rest-1");
    }
  });

  it("staffAccessGate returns no-session when no staff session", async () => {
    const sources: StaffGateSources = {
      staffSession: async () => null,
      restaurantBySlug: async () => mockRestaurant,
      subscriptionExpired: async () => false,
    };
    const result = await staffAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("no-session");
    }
  });

  it("staffAccessGate returns restaurant-missing when restaurant not found", async () => {
    const sources: StaffGateSources = {
      staffSession: async () => mockStaffSession,
      restaurantBySlug: async () => null,
      subscriptionExpired: async () => false,
    };
    const result = await staffAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("restaurant-missing");
    }
  });

  it("staffAccessGate returns blocked for blocked restaurant", async () => {
    const sources: StaffGateSources = {
      staffSession: async () => mockStaffSession,
      restaurantBySlug: async () => ({ ...mockRestaurant, blocked: true }),
      subscriptionExpired: async () => false,
    };
    const result = await staffAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("blocked");
    }
  });

  it("staffAccessGate returns billing-expired for expired subscription", async () => {
    const sources: StaffGateSources = {
      staffSession: async () => mockStaffSession,
      restaurantBySlug: async () => mockRestaurant,
      subscriptionExpired: async () => true,
    };
    const result = await staffAccessGate(sources);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("billing-expired");
    }
  });
});

describe("authz-core - Access Messages", () => {
  it("ownerAccessMessage returns billing expired message for billing-expired", () => {
    const msg = ownerAccessMessage({ ok: false, reason: "billing-expired" });
    expect(msg).toBe("انتهت الفترة المجانية — جدّد اشتراكك");
  });

  it("ownerAccessMessage returns unauthorized message for unauthorized", () => {
    const msg = ownerAccessMessage({ ok: false, reason: "unauthorized" });
    expect(msg).toBe("غير مصرح — أعد تسجيل الدخول");
  });

  it("staffAccessMessage returns correct messages for each reason", () => {
    expect(staffAccessMessage({ ok: false, reason: "no-session" })).toBe("غير مصرح — أعد الدخول بالاسم والكود السري");
    expect(staffAccessMessage({ ok: false, reason: "restaurant-missing" })).toBe("المطعم غير موجود");
    expect(staffAccessMessage({ ok: false, reason: "blocked" })).toBe("المطعم موقوف مؤقتًا — تواصل مع الإدارة");
    expect(staffAccessMessage({ ok: false, reason: "billing-expired" })).toBe("انتهت الفترة المجانية — جدّد اشتراكك من لوحة الإدارة");
  });
});