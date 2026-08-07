import "server-only";
import { prisma } from "@/lib/prisma";

/** توليد كود موظفين (4 أرقام) غير مستخدم من قبل أي مطعم */
export async function generateUniqueStaffPin(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    const existing = await prisma.restaurant.findFirst({
      where: { staffPin: pin },
      select: { id: true },
    });
    if (!existing) return pin;
  }
  throw new Error("تعذّر توليد كود موظفين فريد");
}

/** هل الكود مستخدم من مطعم آخر غير restaurantId؟ */
export async function isStaffPinTaken(pin: string, restaurantId?: string): Promise<boolean> {
  const existing = await prisma.restaurant.findFirst({
    where: { staffPin: pin, ...(restaurantId ? { id: { not: restaurantId } } : {}) },
    select: { id: true },
  });
  return !!existing;
}
