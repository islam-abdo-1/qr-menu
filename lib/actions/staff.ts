"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";

const staffInputSchema = z.object({
  enabled: z.boolean(),
  pin: z
    .string()
    .regex(/^\d{4}$/, "الكود السري يجب أن يكون 4 أرقام")
    .optional(),
});

/** إعدادات الموظفين: تفعيل/إيقاف دخول /staff، وعرض/تغيير الكود الجماعي للفريق */
export async function updateStaffSettingsAction(input: {
  enabled: boolean;
  pin?: string;
}): Promise<ActionResult<{ pin: string } | null>> {
  const parsed = staffInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "بيانات غير صالحة");
  }
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    let pin = "";
    if (parsed.data.enabled) {
      pin = parsed.data.pin ?? String(Math.floor(1000 + Math.random() * 9000));
    }

    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { staffPin: parsed.data.enabled ? pin : "" },
    });

    return ok(parsed.data.enabled ? { pin } : null);
  } catch (e) {
    console.error("[staff]", e);
    return fail("فشل حفظ إعدادات الموظفين");
  }
}
