/**
 * PHASE 5.1 — نواة التفويض الخالصة (قابلة للاختبار دون خادم/قاعدة).
 * القرارات الأمنية هنا فقط: من يُسمح له بماذا، وسبب الرفض.
 * الربط الفعلي (جلسة/قاعدة) في lib/authz.ts — النواة تُحقن بالمصادر.
 */

export type OwnerAccess =
  | { ok: true; restaurant: RestaurantLike }
  | { ok: false; reason: "unauthorized" | "billing-expired" };

export type MenuEditorAccess = { ok: true; restaurant: RestaurantLike } | { ok: false };

export type StaffAccess =
  | { ok: true; session: StaffSessionLike; restaurant: RestaurantLike }
  | { ok: false; reason: "no-session" | "restaurant-missing" | "blocked" | "billing-expired" };

export interface RestaurantLike {
  id: string;
  slug: string;
  name: string;
  blocked: boolean;
  trialEndsAt: Date | string | null;
  paidUntil: Date | string | null;
  billingExempt: boolean;
}

export interface StaffSessionLike {
  slug: string;
  name: string;
}

export interface GateSources {
  ownerRestaurant: () => Promise<RestaurantLike | null>;
  subscriptionExpired: (r: RestaurantLike) => Promise<boolean>;
}

export interface StaffGateSources {
  staffSession: () => Promise<StaffSessionLike | null>;
  restaurantBySlug: (slug: string) => Promise<RestaurantLike | null>;
  subscriptionExpired: (r: RestaurantLike) => Promise<boolean>;
}

/** رسائل الرفض الموحّدة — مصدر واحد للصياغة، تُحفظ حرفيًا عند كل مستهلك */
export const UNAUTHORIZED_MESSAGE = "غير مصرح — أعد تسجيل الدخول";
export const BILLING_EXPIRED_MESSAGE = "انتهت الفترة المجانية — جدّد اشتراكك";
export const BILLING_EXPIRED_STAFF_MESSAGE = "انتهت الفترة المجانية — جدّد اشتراكك من لوحة الإدارة";
export const BLOCKED_MESSAGE = "المطعم موقوف مؤقتًا — تواصل مع الإدارة";
export const STAFF_UNAUTHORIZED_MESSAGE = "غير مصرح — أعد الدخول بالاسم والكود السري";

/**
 * بوابة إجراءات المالك القياسية: هوية جلسة صالحة + ملكية المطعم + اشتراك سارٍ.
 * عزل المستأجرات: لا يعيد المطعم إلا كما حدّده مصدر المالك — كل استعلام لاحق
 * في الإجراء يجب أن يُقيَّد بـ restaurant.id نفسه (لا يعبر للغير أبدًا).
 */
export async function ownerAccessGate(sources: GateSources): Promise<OwnerAccess> {
  const restaurant = await sources.ownerRestaurant();
  if (!restaurant) return { ok: false, reason: "unauthorized" };
  if (await sources.subscriptionExpired(restaurant)) {
    return { ok: false, reason: "billing-expired" };
  }
  return { ok: true, restaurant };
}

/**
 * بوابة تعديل المنيو (الأعلى حدة): مالك + غير محظور + اشتراك سارٍ —
 * أي رفض يُعامل كرفض واحد (نفس رسالة عدم التصريح) كما كان سابقًا.
 */
export async function menuEditorGate(sources: GateSources): Promise<MenuEditorAccess> {
  const access = await ownerAccessGate(sources);
  if (!access.ok || access.restaurant.blocked) return { ok: false };
  return { ok: true, restaurant: access.restaurant };
}

/**
 * بوابة الموظفين: جلسة موظف صالحة + إعادة فحص حية (حظر/اشتراك) لكل استخدام —
 * جلسة سارية لا تكفي (SEC-007): أي تغيير في حالة المطعم يوقف الخدمة فورًا.
 */
export async function staffAccessGate(sources: StaffGateSources): Promise<StaffAccess> {
  const session = await sources.staffSession();
  if (!session) return { ok: false, reason: "no-session" };
  const restaurant = await sources.restaurantBySlug(session.slug);
  if (!restaurant) return { ok: false, reason: "restaurant-missing" };
  if (restaurant.blocked) return { ok: false, reason: "blocked" };
  if (await sources.subscriptionExpired(restaurant)) {
    return { ok: false, reason: "billing-expired" };
  }
  return { ok: true, session, restaurant };
}

/** رسالة الرفض للمالك — تطابق صياغة ما قبل التوحيد حرفيًا */
export function ownerAccessMessage(access: { ok: false; reason: "unauthorized" | "billing-expired" }): string {
  return access.reason === "billing-expired" ? BILLING_EXPIRED_MESSAGE : UNAUTHORIZED_MESSAGE;
}

/** رسالة الرفض للموظف — تطابق صياغة ما قبل التوحيد حرفيًا */
export function staffAccessMessage(access: {
  ok: false;
  reason: "no-session" | "restaurant-missing" | "blocked" | "billing-expired";
}): string {
  switch (access.reason) {
    case "no-session":
      return STAFF_UNAUTHORIZED_MESSAGE;
    case "restaurant-missing":
      return "المطعم غير موجود";
    case "blocked":
      return BLOCKED_MESSAGE;
    case "billing-expired":
      return BILLING_EXPIRED_STAFF_MESSAGE;
  }
}
