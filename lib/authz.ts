import "server-only";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { isOwnerBillingExpired } from "@/lib/billing";
import { getStaffSession } from "@/lib/staff-session";
import {
  menuEditorGate,
  ownerAccessGate,
  staffAccessGate,
  type MenuEditorAccess,
  type OwnerAccess,
  type StaffAccess,
} from "@/lib/authz-core";

/**
 * PHASE 5.1 — الربط الحي لبوابات التفويض.
 * القرارات المنطقية في authz-core (قابلة للاختبار) — هنا المصادر الفعلية فقط.
 *
 * الحدود المتعمّدة المحفوظة كما هي:
 * - إجراءات تعديل المنيو: مالك + غير محظور + اشتراك سارٍ (requireMenuEditorAccess).
 * - إجراءات اللوحة الأخرى: مالك + اشتراك سارٍ (requireOwnerAccess).
 * - إجراءات الموظفين: جلسة موظف + إعادة فحص حية للحظر/الاشتراك (requireStaffAccess).
 * - الهوية فقط (بدون اشتراك): getOwnerRestaurant مباشرة — للصفحات التي يجب أن
 *   تعمل حتى مع اشتراك منتهٍ (حالة الاشتراك، بدء التجديد).
 */

/** بوابة المالك القياسية (مالك + اشتراك سارٍ) */
export function requireOwnerAccess(): Promise<OwnerAccess> {
  return ownerAccessGate({
    ownerRestaurant: getOwnerRestaurant,
    subscriptionExpired: isOwnerBillingExpired,
  });
}

/** بوابة تعديل المنيو (مالك + غير محظور + اشتراك سارٍ) */
export function requireMenuEditorAccess(): Promise<MenuEditorAccess> {
  return menuEditorGate({
    ownerRestaurant: getOwnerRestaurant,
    subscriptionExpired: isOwnerBillingExpired,
  });
}

/** بوابة الموظفين (جلسة + إعادة فحص حية) */
export function requireStaffAccess(): Promise<StaffAccess> {
  return staffAccessGate({
    staffSession: getStaffSession,
    restaurantBySlug: (slug) => prisma.restaurant.findUnique({ where: { slug } }),
    subscriptionExpired: isOwnerBillingExpired,
  });
}
