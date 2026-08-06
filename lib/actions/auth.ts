"use server";

import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validations";
import { ActionResult, fail, fromZod, ok } from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";

export async function signInAction(
  email: string,
  password: string,
): Promise<ActionResult<null>> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env;
  const url = NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const isPlaceholder =
    /dummy|your-|your-project-ref|example/.test(url) ||
    /dummy|your-|your-supabase-anon-key/.test(anon);
  if (!url || isPlaceholder) {
    return fail("Supabase غير مكوّن. أضف مفاتيحك الحقيقية إلى ملف .env.local");
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return fail(authErrorMessage(error.message));
    return ok(null);
  } catch {
    return fail("تعذّر الاتصال بخدمة الدخول، حاول لاحقًا");
  }
}

/** ترجمة أخطاء Supabase الشائعة إلى رسائل واضحة للمستخدم */
function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) {
    return "البريد غير مؤكد — أكّد الإيميل من رسالة التأكيد أو من لوحة Supabase (Add user → Auto Confirm)";
  }
  if (m.includes("invalid login credentials")) {
    return "بيانات الدخول غير صحيحة — تأكد من البريد وكلمة المرور";
  }
  if (m.includes("rate limit")) {
    return "طلبات كثيرة — انتظر دقيقتين وحاول مجددًا";
  }
  if (m.includes("too many requests")) {
    return "طلبات كثيرة من هذا الجهاز — انتظر قليلًا ثم حاول";
  }
  if (m.includes("user not found") || m.includes("no user found")) {
    return "لا يوجد حساب بهذا البريد — أنشئ الأدمن أولًا من لوحة Supabase";
  }
  if (m.includes("provider")) {
    return "مزوّد الدخول غير مفعّل في إعدادات Supabase";
  }
  return message;
}

export async function signOutAction(): Promise<ActionResult<null>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) return fail("تعذّر تسجيل الخروج");
    revalidatePath("/", "layout");
    return ok(null);
  } catch {
    return fail("تعذّر تسجيل الخروج من الحساب");
  }
}