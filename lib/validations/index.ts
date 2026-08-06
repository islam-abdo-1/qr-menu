import { z } from "zod";
import { cleanField } from "@/lib/sanitize";

/** إزالة الأحرف غير الآمنة بربط مع التحقق من الطول */
const text = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `أقصى حد ${max} حرف`).transform(cleanField);

export const categorySchema = z.object({
  name: text(1, 60, "اسم القسم مطلوب"),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const menuItemSchema = z.object({
  name: text(1, 120, "اسم العنصر مطلوب"),
  description: z
    .string()
    .trim()
    .max(400, "الوصف طويل جدًا")
    .transform(cleanField)
    .optional(),
  price: z.coerce
    .number()
    .positive("السعر يجب أن يكون أكبر من صفر")
    .max(1_000_000, "السعر كبير جدًا"),
  categoryId: z.string().min(1, "اختر قسمًا"),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isAvailable: z.boolean().optional(),
});

export const settingsSchema = z.object({
  restaurantName: text(1, 80, "اسم المطعم مطلوب"),
  currency: z.string().trim().length(3, "رمز عملة ثلاثي الأحرف فقط").toUpperCase(),
  themePrimary: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح (مثال: #C84C21)"),
  logoUrl: z.string().trim().max(500).optional().nullable(),
});

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح").max(254),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(72),
});

export const imageUploadSchema = z.object({
  name: z.string().max(255),
  size: z.number().max(12 * 1024 * 1024, "الصورة أكبر من 12MB"),
  type: z
    .string()
    .max(40)
    .startsWith("image/", "يجب أن يكون الملف صورة"),
});