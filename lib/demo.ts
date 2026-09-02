import "server-only";

/**
 * عرض تجريبي عام (SEC-004): مستأجر معزول للتصفح فقط، بلا أي صلاحية.
 * الهوية معتمدة على slug المستأجر التجريبي — وليست على متغير بيئة (لا يمكن
 * «إطفاء» الأمان بإعداد env). أي تعديل/دخول على هذا المستأجر يُرفض خادميًا.
 */
export const DEMO_SLUG = "demo";

/** هل هذا المستأجر هو العرض التجريبي العام (الصندوق الرملي للقراءة فقط)؟ */
export function isDemoSlug(slug: string | null | undefined): boolean {
  return slug === DEMO_SLUG;
}

/** رسالة حجب الطلبات في العرض التجريبي — تُعرض للزبون كفشل طلب طبيعي */
export const DEMO_ORDER_MESSAGE =
  "العرض التجريبي للتصفح فقط — إرسال الطلبات غير متاح هنا";

/** رسالة رفض دخول الموظفين للعرض التجريبي (نفس نغمة الاسم غير المسجّل: بلا تمييز) */
export const DEMO_STAFF_MESSAGE = "هذا الاسم غير مسجّل في قائمة الموظفين";

/** هل يُسمح للعرض التجريبي بإرسال طلب فعلي؟ — دائمًا لا (قراءة فقط صارمة) */
export function demoOrderAllowed(slug: string | null | undefined): boolean {
  return !isDemoSlug(slug);
}

/** هل يُسمح بإنشاء جلسة موظف على هذا المستأجر؟ — ممنوع على العرض التجريبي */
export function demoStaffLoginAllowed(slug: string | null | undefined): boolean {
  return !isDemoSlug(slug);
}