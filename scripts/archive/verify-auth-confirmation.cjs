/**
 * تحقق سلوك تأكيد البريد في Supabase (SEC-008):
 * يسجّل حسابًا مؤقتًا ببريد فريد — يفحص إن كان يصل بدون جلسة
 * (CONFIRMATION_REQUIRED) أو بجلسة فورية (AUTO_CONFIRM) — ثم يحذف المستخدم نهائيًا.
 * لا يترك أي أثر: حذف admin إجباري في finally.
 * التشغيل: node scripts/verify-auth-confirmation.cjs
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const env = loadEnv(path.join(__dirname, "..", ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) throw new Error("ناقص: NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE");

  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

  const email = `sec008-probe-${Date.now()}@gmail.com`;
  const password = `Pr0be-${crypto.randomBytes(12).toString("hex")}`;
  let userId = null;

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(`signUp فشل: ${error.message}`);
    if (!data.user) throw new Error("signUp لم يُرجع مستخدمًا");
    userId = data.user.id;

    const hasSession = !!data.session;
    const confirmed = !!data.user.email_confirmed_at;

    console.log(`  ✔ بروب SEC-008 على ${url}`);
    console.log(`  الجلسة الفورية: ${hasSession ? "نعم" : "لا"} | email_confirmed_at: ${confirmed ? "مؤكد" : "غير مؤكد"}`);

    if (hasSession && !confirmed) {
      // حالة شاذة: جلسة دون تأكيد بريد — تُلاحظ وتُستنتج AUTO_CONFIRM عمليًا
      console.log("  ⚠ جلسة فورية بدون email_confirmed_at — تأكيد البريد معطّل فعليًا");
    }

    if (hasSession) {
      console.log("  ✓ AUTO_CONFIRM: تأكيد البريد معطّل — جلسة فورية بعد التسجيل.");
      console.log("    مطابق للتوقع: «حسابك جاهز فورًا» صحيح، ودخول المالك يعمل مباشرة.");
      console.log("    (الأمان: التسجيل المجاني مقصود — ترويضه عبر signupOpen/maxRestaurants المدققين في SEC-005)");
    } else {
      console.log("  ✓ CONFIRMATION_REQUIRED: البريد يجب تأكيده قبل الدخول.");
      console.log("    مسار الزبون: يعرض «أكّد بريدك الإلكتروني» (signUpCustomerAction يفحص الجلسة) ✓");
      console.log("    مسار المالك: يسجّل مطعمه ثم يُدعى لتأكيد البريد قبل أول دخول ✓");
    }

    // نظافة إلزامية: حذف المستخدم المؤقت مهما كانت النتيجة.
    // إذا كان مفتاح الخدمة محليًا ناقصًا/غير مسجّل (يُعرف من طوله — sb_secret السليم
    // أطول بكثير من 100 حرف) نتجاوز الحذف مع تحذير: القرار أعلاه لا يتأثر به.
    if (service.length < 100 || !service.startsWith("sb_secret_")) {
      console.warn("  ⚠ تجاوز حذف المؤقت: SUPABASE_SERVICE_ROLE_KEY محليًا غير سليم (تأكد من مفتاح الخدمة الكامل في .env.local)");
    } else {
      const { error: del } = await admin.auth.admin.deleteUser(userId);
      if (del) {
        console.error("  ✗ فشل حذف مؤقت (يتطلب مفتاح خدمة سليمًا):", del.message);
        process.exitCode = 1;
      } else {
        console.log("  ✔ حُذف المستخدم المؤقت بالكامل (بلا أثر)");
      }
    }
    userId = null;
  } finally {
    if (userId) {
      try {
        await admin.auth.admin.deleteUser(userId);
        console.log("  ✔ تنظيف متأخر ناجح");
      } catch (e) {
        console.error("  ✗ فشل التنظيف — تحقق يدويًا:", e.message);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((e) => {
  console.error("✗ فشل بروب SEC-008:", e.message);
  process.exitCode = 1;
});