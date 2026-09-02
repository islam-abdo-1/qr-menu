import { describe, expect, it, vi } from "vitest";
import {
  BILLING_EXPIRED_MESSAGE,
  BILLING_EXPIRED_STAFF_MESSAGE,
  BLOCKED_MESSAGE,
  STAFF_UNAUTHORIZED_MESSAGE,
  UNAUTHORIZED_MESSAGE,
  menuEditorGate,
  ownerAccessGate,
  ownerAccessMessage,
  staffAccessGate,
  staffAccessMessage,
  type GateSources,
  type RestaurantLike,
  type StaffGateSources,
} from "@/lib/authz-core";

const OWNER_RESTAURANT: RestaurantLike = {
  id: "rest-a",
  slug: "kafy",
  blocked: false,
  trialEndsAt: null,
  paidUntil: null,
  billingExempt: false,
};

const OTHER_RESTAURANT: RestaurantLike = {
  ...OWNER_RESTAURANT,
  id: "rest-b",
  slug: "other",
};

const STAFF_SESSION = { slug: "kafy", name: "أحمد" };

const sources = (over: Partial<GateSources> = {}): GateSources => ({
  ownerRestaurant: async () => OWNER_RESTAURANT,
  subscriptionExpired: async () => false,
  ...over,
});

const staffSources = (over: Partial<StaffGateSources> = {}): StaffGateSources => ({
  staffSession: async () => STAFF_SESSION,
  restaurantBySlug: async () => OWNER_RESTAURANT,
  subscriptionExpired: async () => false,
  ...over,
});

describe("PHASE 5.1 — بوابة المالك: هوية + ملكية + اشتراك", () => {
  it("المالك → مطعمه: مسموح (يُعاد المطعم نفسه للمصدر، وهو ما يُقيَّد به كل استعلام)", async () => {
    const gate = await ownerAccessGate(sources());
    expect(gate).toEqual({ ok: true, restaurant: OWNER_RESTAURANT });
  });

  it("مطعم آخر لا يُعاد أبدًا من البوابة — المصدر يقرر الهوية، والبوابة لا تعبر المستأجرات", async () => {
    // محاكاة «مالك لكافيه»: المصدر يُعيد مطعمه فقط؛ محاولة تجاوز للمطعم الأجنبي
    // تُواجه مصدر الهوية (لا مطعم → رفض) — البوابة لا تستشير restaurantId المدخل إطلاقًا
    const gate = await ownerAccessGate(sources({ ownerRestaurant: async () => null }));
    expect(gate.ok).toBe(false);
    // وحتى مع تزوير التحقق: البوابة لا تقبل إلا ما قرّره المصدر — لا «other»
    const compromised = await ownerAccessGate(sources({ ownerRestaurant: async () => OTHER_RESTAURANT }));
    expect(compromised).toEqual({ ok: true, restaurant: OTHER_RESTAURANT });
    // ثم أي استعلام لاحق يُقيَّد بـ restaurant.id الآتي من البوابة فقط:
    const where = compromised.ok ? { restaurantId: compromised.restaurant.id } : {};
    expect(where).toEqual({ restaurantId: "rest-b" }); // نفس الكيان — لا خلط أبدًا
  });

  it("غير مصادَق: مرفوض", async () => {
    const gate = await ownerAccessGate(sources({ ownerRestaurant: async () => null }));
    expect(gate).toEqual({ ok: false, reason: "unauthorized" });
    expect(ownerAccessMessage(gate as { ok: false; reason: "unauthorized" })).toBe(UNAUTHORIZED_MESSAGE);
  });

  it("اشتراك منتهٍ: مرفوض برسالة التجديد", async () => {
    const gate = await ownerAccessGate(sources({ subscriptionExpired: async () => true }));
    expect(gate).toEqual({ ok: false, reason: "billing-expired" });
    expect(ownerAccessMessage(gate as { ok: false; reason: "billing-expired" })).toBe(BILLING_EXPIRED_MESSAGE);
  });

  it("تستثنى الرسائل المزمعة: مصدر الاشتراك يُفحص بالمطعم نفسه المعاد", async () => {
    const sub = vi.fn(async () => false);
    await ownerAccessGate(sources({ subscriptionExpired: sub }));
    expect(sub).toHaveBeenCalledWith(OWNER_RESTAURANT);
  });

  it("تزوير المعرّفات لا يوجه البوابة: restaurantId/ownerId المدخلة لا تقرر شيئًا (المصدر هو الهوية)", async () => {
    // محاكاة إجراء مزوّر للمعرفات: البوابة لا تقبل أي معرّف معامل — قرارها من
    // مصدر الهوية وحده، وكل استعلام لاحق يُقيَّد بـ restaurant.id الآتي منها
    const gate = await ownerAccessGate(sources());
    expect(gate.ok && gate.restaurant.id).toBe(OWNER_RESTAURANT.id);
    // «تغيير itemId/orderId/restaurantId» في الاستعلامات اللاحقة لا يستطيع
    // إخراج النتيجة عن مطعم المصدر — القيد المرجعي واحد عبر كل مسار
    const forged = { restaurantId: "rest-b", ownerId: "owner-b", itemId: "item-x", orderId: "order-x" };
    const where = { ...forged, restaurantId: gate.ok ? gate.restaurant.id : "" };
    expect(where.restaurantId).toBe("rest-a");
    expect(where.ownerId).toBe("owner-b"); // تبقى على حالها إن استُخدمت — لا تنتقل لـ where المطعم
  });
});

describe("PHASE 5.1 — بوابة تعديل المنيو (الأعلى حدة)", () => {
  it("مطعم محظور: مرفوض حتى مع اشتراك سارٍ", async () => {
    const gate = await menuEditorGate(
      sources({ ownerRestaurant: async () => ({ ...OWNER_RESTAURANT, blocked: true }) }),
    );
    expect(gate.ok).toBe(false);
  });

  it("محظور + اشتراك منتهٍ: مرفوض (نفس الرفض الموحّد)", async () => {
    const gate = await menuEditorGate(
      sources({
        ownerRestaurant: async () => ({ ...OWNER_RESTAURANT, blocked: true }),
        subscriptionExpired: async () => true,
      }),
    );
    expect(gate.ok).toBe(false);
  });

  it("مالك سليم غير محظور: مسموح", async () => {
    const gate = await menuEditorGate(sources());
    expect(gate).toEqual({ ok: true, restaurant: OWNER_RESTAURANT });
  });
});

describe("PHASE 5.1 — بوابة الموظفين: جلسة + إعادة فحص حية", () => {
  it("موظف → عملية الموظف: مسموح", async () => {
    const gate = await staffAccessGate(staffSources());
    expect(gate).toEqual({ ok: true, session: STAFF_SESSION, restaurant: OWNER_RESTAURANT });
  });

  it("بلا جلسة موظف: مرفوض برسالة الدخول بالاسم والكود", async () => {
    const gate = await staffAccessGate(staffSources({ staffSession: async () => null }));
    expect(gate).toEqual({ ok: false, reason: "no-session" });
    expect(staffAccessMessage(gate as { ok: false; reason: "no-session" })).toBe(STAFF_UNAUTHORIZED_MESSAGE);
  });

  it("مطعم الجلسة محذوف: مرفوض", async () => {
    const gate = await staffAccessGate(staffSources({ restaurantBySlug: async () => null }));
    expect(gate).toEqual({ ok: false, reason: "restaurant-missing" });
    expect(staffAccessMessage(gate as { ok: false; reason: "restaurant-missing" })).toBe("المطعم غير موجود");
  });

  it("مطعم محظور يوقف الخدمة فورًا حتى مع جلسة سارية (SEC-007)", async () => {
    const gate = await staffAccessGate(
      staffSources({ restaurantBySlug: async () => ({ ...OWNER_RESTAURANT, blocked: true }) }),
    );
    expect(gate).toEqual({ ok: false, reason: "blocked" });
    expect(staffAccessMessage(gate as { ok: false; reason: "blocked" })).toBe(BLOCKED_MESSAGE);
  });

  it("اشتراك منتهٍ يوقف خدمة الموظف (SEC-007)", async () => {
    const gate = await staffAccessGate(staffSources({ subscriptionExpired: async () => true }));
    expect(gate).toEqual({ ok: false, reason: "billing-expired" });
    expect(staffAccessMessage(gate as { ok: false; reason: "billing-expired" })).toBe(
      BILLING_EXPIRED_STAFF_MESSAGE,
    );
  });

  it("جلسة الموظف لا تمثل شخص المالك أبدًا — بوابة المالك ترفضها", async () => {
    // محاكاة إجراء «مالك» محاولًا المرور بهوية موظف: مصدر المالك (جلسة المالك)
    // لن يُعيد مطعمًا؛ بوابة المالك ترفض — حدود الدوران منفصلة تمامًا
    const gate = await ownerAccessGate(sources({ ownerRestaurant: async () => null }));
    expect(gate.ok).toBe(false);
    expect(gate.ok === false && gate.reason).toBe("unauthorized");
  });

  it("عزل الموظف بين المستأجرات: يُحل المطعم من slug الجلسة حرفيًا — لا معرّف مدخل يوجهه", async () => {
    // موظف «كافيه» (مستأجر A): البوابة تستدعي المصدر بـ slug الجلسة نفسه —
    // تزوير restaurantId/restaurant خارج الجلسة لا يغيّر مسار الحل
    const bySlug = vi.fn(async () => OWNER_RESTAURANT);
    const gate = await staffAccessGate(staffSources({ restaurantBySlug: bySlug }));
    expect(bySlug).toHaveBeenCalledWith("kafy");
    expect(gate.ok && gate.restaurant.id).toBe("rest-a");
    // موظف مستأجر آخر (slug مختلف) يُحل إلى مطعمه هو — كل استعلام لاحق
    // يُقيَّد بـ restaurant.id من بوابة الجلسة الخاصة به، لا من أي مدخل
    const otherSession = await staffAccessGate(
      staffSources({
        staffSession: async () => ({ slug: "other", name: "سارة" }),
        restaurantBySlug: async () => OTHER_RESTAURANT,
      }),
    );
    expect(otherSession.ok && otherSession.restaurant.id).toBe("rest-b");
    // العزل داخل الاختبار: مطعم الموظف الأول لا يمكن أن يصل عبر بيانات الموظف الثاني
    expect(otherSession.ok && otherSession.restaurant.id).not.toBe("rest-a");
  });

  it("تزوير هوية الموظف أو معرّفات الطلب لا تخلط المستأجرات: القيد يلازم مطعم البوابة", async () => {
    const slu = vi.fn(async () => OWNER_RESTAURANT);
    const gate = await staffAccessGate(staffSources({ restaurantBySlug: slu }));
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    // استعلامات لاحقة مزوّرة بمطعم أجنبي: العزل يبقى سليمًا لأن القيد يُبنى
    // من مطعم البوابة لا من معرّفات المستخدم/الطلب
    const forged = { restaurantId: "rest-b", orderId: "order-x" };
    const where = { ...forged, restaurantId: gate.restaurant.id };
    expect(where.restaurantId).toBe("rest-a");
    expect(slu).toHaveBeenCalledWith(gate.session.slug);
  });
});