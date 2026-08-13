import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasValidSession } from "@/lib/session";

/**
 * المسارات المحجوزة للنظام — تُستثنى من إعادة كتابة المستأجرين دائمًا.
 * (لوحة الإدارة، الدخول، Staff، صفحات /m، واجهات API، وملفات عامة).
 */
const RESERVED = new Set([
  "admin",
  "login",
  "signup",
  "forgot-password",
  "update-password",
  "staff",
  "m",
  "api",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "googlecbbd9aafd505a6e3.html",
  ".well-known",
]);
const FILE_EXT = /\.(?:a?png|jpe?g|svg|webp|gif|ico|txt|xml|map|json|woff2?|wasm|css|js)$/i;

/**
 * توجيه متعدد المستأجرين (Multi-tenant):
 *  - `domain.com/kafy`    → يُعاد كتابته داخليًا إلى `/m/kafy`
 *
 * قرارات العلية المعمارية:
 *  - نقوم بـ REWRITE وليس REDIRECT — يبقى الرابط في المتصفح نظيفًا
 *    (`/kafy`) أفضل للطباعة على QR وشارة المطعم، بينما يعالج الصفحة نفسها.
 *  - لا استعلام DB هنا إطلاقًا (الـ Middleware بيئة Edge بلا pg)؛
 *    الصفحة `/m/[slug]` نفسها تتحقق من وجود المطعم وتعرض 404 عند الغياب.
 *  - أي مقطع مسار غير محجوز يُعامل كمستأجر — خرائط QR القديمة بـ /m/... تبقى تعمل.
 */
function tenantRewrite(pathname: string): string | null {
  if (pathname === "/") return null;
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || RESERVED.has(slug) || FILE_EXT.test(slug)) return null;
  if (parts.length === 1) return `/m/${slug}`;
  return null;
}

/**
 * Middleware: جلسة Supabase SSR + اللغة + توجيه المستأجرين.
 * القاعدة الذهبية لمنع "طُردت من الجلسة عند التحديث":
 *  - كل استجابة جديدة (redirect/rewrite) ترث كوكيز supabaseResponse
 *    المجددة من getUser() — لا تُسقط الجلسة المنعشة أبدًا.
 *  - فحص الجلسة على /admin و /login فقط، حتى لا يلمس المنيو العام (ISR).
 *  - تحقق محلي أولًا (فك JWT بلا شبكة): توكن غير منتهٍ → صفر طلبات خادم مصادقة
 *    ولا سباق تدوير refresh token. getUser() فقط عند انتهاء التوكن (مرة بالساعة).
 */
export async function updateSession(request: NextRequest) {
  /**
   * النمط الرسمي لتحديث الجلسة: نكتب الكوكيز المنعشة على كائن الطلب أولًا،
   * ثم نبني الاستجابة من الطلب المعدَّل — هكذا تصل الكوكيز الجديدة
   * إلى Server Components (الـ layout) في نفس الطلب، فلا يرى layout
   * توكنًا منتهيًا بعد أن جدّد الـ middleware الجلسة (سبب «طلب تسجيل الدخول» المتكرر).
   */
  const createSupabaseResponse = () => NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      cookieOptions: {
        maxAge: 60 * 60 * 24 * 30, // 30 يومًا — «تذكرني» بعد إغلاق المتصفح
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, cacheHeaders) {
          // أولًا: تعميم الكوكيز المحدّثة على الطلب (تصل للـ layout في نفس الطلب)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // ثانيًا: بناء الاستجابة من الطلب المعدَّل + ترويسات منع تخزين الجلسات
          supabaseResponse = createSupabaseResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          Object.entries(cacheHeaders).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  let supabaseResponse = createSupabaseResponse();

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login");

  // لا نتحقق من الجلسة في الصفحات العامة إطلاقًا (سرعة + ثبات ISR)
  let hasSession = false;
  if (isAdminPath || isLoginPath) {
    // تحقق محلي أولًا (صفر شبكة): توكن غير منتهٍ = جلسة قائمة بلا أي طلب خادم مصادقة
    hasSession = hasValidSession(request.cookies.getAll());
    if (!hasSession) {
      // توكن منتهٍ أو غائب — نجدد عبر getUser() (يكتب الكوكيز الجديدة في setAll)
      const { data } = await supabase.auth.getUser();
      hasSession = !!data.user;
    }
  }

  /**
   * إعادة توجيه أو كتابة مع الحفاظ على كوكيز الجلسة:
   * أي استجابة مُسنّدة حديثًا ترث كل ما كُتب على supabaseResponse
   * (للجلسة المنعشة من getUser()) فلا تفقد الجلسة أبدًا.
   */
  const inheritCookies = (res: NextResponse) => {
    supabaseResponse.cookies
      .getAll()
      .forEach((c) => res.cookies.set(c.name, c.value, c));
    return res;
  };

  // 1) توجيه المستأجرين: rewrite إلى صفحة المنيو الداخلية (بلا استعلام)
  const rewrite = tenantRewrite(pathname);
  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    return inheritCookies(NextResponse.rewrite(url));
  }

  // 2) حماية لوحة الأدمن — بدون جلسة نعيد التوجيه لصفحة الدخول مع حفظ الوجهة
  if (isAdminPath && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return inheritCookies(NextResponse.redirect(url));
  }

  // 3) مسجّل دخول يفتح /login → مباشرة إلى لوحة الإدارة (دون إسقاط الكوكيز)
  if (isLoginPath && hasSession) {
    return inheritCookies(NextResponse.redirect(new URL("/admin", request.url)));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

export default updateSession;