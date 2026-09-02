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
    .max(1_000_000, "السعر كبير جدًا")
    .optional(),
  categoryId: z.string().min(1, "اختر قسمًا"),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  // بيانات تعريف الصورة المضغوطة — تُحسب على الخادم أثناء الرفع (قراءة فقط)
  imageWidth: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  imageHeight: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  imageSizeKB: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  isAvailable: z.boolean().optional(),
  // خصم نسبة (0-100) — null/0 = بدون خصم
  discountPercentage: z.coerce
    .number()
    .int()
    .min(0, "النسبة يجب أن تكون بين 0 و 100")
    .max(100, "النسبة يجب أن تكون بين 0 و 100")
    .optional()
    .nullable(),
  // وضع المقاسات: أحرف (S/M/L) أو وزن (ربع/نص/كيلو + مخصص) — وضع واحد لكل صنف
  sizeMode: z.enum(["letters", "weight"]).default("letters"),
  // مقاسات مفعلة بسعرها الخاص — حتى 8 مقاسات (أحرف أو أوزان مخصصة)
  sizes: z
    .array(
      z.object({
        sizeCode: z.string().trim().min(1, "اسم المقاس مطلوب").max(12, "اسم المقاس طويل جدًا"),
        price: z.coerce
          .number()
          .positive("سعر المقاس يجب أن يكون أكبر من صفر")
          .max(1_000_000, "سعر المقاس كبير جدًا"),
      }),
    )
    .max(8, "8 مقاسات كحد أقصى")
    .optional(),
}).superRefine((data, ctx) => {
  // السعر العادي إلزامي فقط عندما لا توجد مقاسات — مع المقاسات يُحسب من أقل سعر
  if ((!data.sizes || data.sizes.length === 0) && data.price === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["price"],
      message: "اكتب سعر العنصر",
    });
  }
});

export const settingsSchema = z.object({
  restaurantName: text(1, 80, "اسم المطعم مطلوب"),
  currency: z.string().trim().length(3, "رمز عملة ثلاثي الأحرف فقط").toUpperCase(),
  themePrimary: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح (مثال: #C84C21)")
    .optional(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  logoWidth: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  logoHeight: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  logoSizeKB: z.coerce.number().int().min(1).max(20000).optional().nullable(),
  deliveryEnabled: z.boolean().optional(),
});

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صالح").max(254),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(72),
});

export const signupSchema = z.object({
  restaurantName: text(1, 60, "اسم المطعم مطلوب"),
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

export const orderSchema = z.object({
  restaurantSlug: text(1, 100, "المطعم مطلوب"),
  customerName: text(1, 80, "اسمك مطلوب"),
  type: z.enum(["dine-in", "delivery"], { message: "نوع الطلب غير صالح" }),
  tableNo: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(300).optional(),
  // مفتاح تفرد اختياري من العميل — يحوّل إعادة الإرسال إلى ردّ بالطلب نفسه (بلا طلب مكرر)
  cartNonce: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,64}$/, "معرف الإرسال غير صالح")
    .optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        qty: z.number().int().min(1).max(50),
        sizeCode: z.string().trim().max(12).optional().nullable(),
      }),
    )
    .min(1, "السلة فارغة")
    .max(30, "عدد الأصناف كبير جدًا"),
});

export const staffLoginSchema = z.object({
  name: text(1, 60, "اسمك مطلوب"),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "الكود السري 4 أرقام فقط"),
});

export const staffNameSchema = z.object({
  name: text(1, 60, "اسم الموظف مطلوب"),
});