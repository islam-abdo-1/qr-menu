"use server";

import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema, signupSchema } from "@/lib/validations";
import { ActionResult, fail, fromZod, ok } from "@/lib/actions/helpers";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateUniqueStaffPin } from "@/lib/staff-pin";

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

/* ───────────────────────── تسجيل مطعم جديد ───────────────────────── */

/** مطعم المالك من الجلسة — تُستخدم في لوحة الإدارة وكل إجراءات التعديل */
function createSupabaseAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/* ───────────────────────── حساب الزبون (المنيو العام) ───────────────────────── */

/** دخول زبون من قائمة المنيو — بدون أي إعادة توجيه */
export async function signInCustomerAction(
  email: string,
  password: string,
): Promise<ActionResult<null>> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
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

/** إنشاء حساب زبون — مجرد حساب تفضيلات، لا يُنشئ مطعمًا */
export async function signUpCustomerAction(
  email: string,
  password: string,
): Promise<ActionResult<null>> {
  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp(parsed.data);
    if (error) return fail(authErrorMessage(error.message));
    if (!data.session) return fail("أكّد بريدك الإلكتروني من الرسالة ثم سجّل دخولك");
    return ok(null);
  } catch {
    return fail("تعذّر الاتصال بخدمة التسجيل، حاول لاحقًا");
  }
}

/** توليد رابط قصير (slug) من اسم المطعم — بحروف لاتينية إن أمكن وإلا عشوائي */
function makeSlugBase(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return latin || `m-${Math.random().toString(36).slice(2, 8)}`;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = makeSlugBase(name);
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 5)}`;
    const existing = await prisma.restaurant.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}

export async function registerRestaurantAction(
  input: z.infer<typeof signupSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) return fail(authErrorMessage(error.message));
    const user = data.user;
    if (!user) return fail("تعذّر إنشاء الحساب — حاول مجددًا");

    try {
      const slug = await uniqueSlug(parsed.data.restaurantName);
      const staffPin = await generateUniqueStaffPin();
      const restaurant = await prisma.restaurant.create({
        data: {
          slug,
          name: parsed.data.restaurantName,
          ownerId: user.id,
          staffPin,
        },
      });
      await prisma.setting.create({
        data: { restaurantName: parsed.data.restaurantName, restaurantId: restaurant.id },
      });
      // موظف افتراضي بنفس اسم المطعم — يمكن إدارته من لوحة الموظفين
      await prisma.staff.create({
        data: { restaurantId: restaurant.id, name: parsed.data.restaurantName },
      });
      return ok({ slug });
    } catch (e) {
      // فشل إنشاء بيانات المطعم — احذف حساب Supabase حتى لا يبقى حسابًا يتيمًا
      console.error("[signup] فشل إنشاء المطعم:", e);
      const admin = createSupabaseAdmin();
      await admin.auth.admin.deleteUser(user.id);
      return fail("تعذّر إنشاء المطعم — حاول مجددًا");
    }
  } catch {
    return fail("تعذّر الاتصال بخدمة التسجيل، حاول لاحقًا");
  }
}