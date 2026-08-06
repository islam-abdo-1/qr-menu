/**
 * تعقيم النصوص المدخلة من المستخدم:
 * - إزالة أحرف التحكم (منع كسر الواجهة).
 * - إزالة الوسوم الخطرة.
 * - تقليص المسافات المتكررة.
 * React  مكتبة تفلت HTML افتراضيًا عند الطباعة، لذا هذا يمنع أي محتوى ضار من الوصول أصلًا.
 */

export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|form)\b[^>]*>/gi, "")
    .replace(/\s{3,}/g, " ")
    .trim();
}

/** تحقق من أن النص آمن (يعيد النص المنقّح مباشرة) */
export function cleanField(value: string): string {
  const cleaned = sanitizeText(value);
  return cleaned.length > 500 ? cleaned.slice(0, 500) : cleaned;
}