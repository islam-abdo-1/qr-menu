import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * المسارات المحجوزة للنظام — تُستثنى من إعادة كتابة المستأجرين دائمًا.
 * (لوحة الإدارة، الدخول، Staff، صفحات /m و /en، واجهات API، وملفات عامة).
 */
const RESERVED = new Set([
  "admin",
  "login",
  "signup",
  "staff",
  "m",
  "en",
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
 *  - `domain.com/kafy/en` → `/m/kafy/en`
 *
 * قرارات العلية المعمارية:
 *  - نقوم بـ REWRITE وليس REDIRECT — يبقى الرابط في المتصفح نظيفًا
 *    (`/kafy`) أفضل للطباعة على QR وشارة المطعم، بينما يعالج الصفحة نفسها.
 *  - لا استعلام DB هنا إطلاقًا (الـ Middleware بيئة Edge بلا pg)؛
 *    الصفحة `/m/[slug]` نفسها تتحقق من وجود المطعم وتعرض 404 عند الغياب.
 *  - أي مقطع مسار غير محجوز يُعامل كمستأجر — خرائط QR قديمة بـ /m/... تبقى تعمل.
 */
function tenantRewrite(pathname: string): string | null {
  if (pathname === "/" || pathname === "/en") return null;
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || RESERVED.has(slug) || FILE_EXT.test(slug)) return null;
  if (parts.length === 1) return `/m/${slug}`;
  if (parts.length === 2 && parts[1] === "en") return `/m/${slug}/en`;
  return null;
}

/**
 * Middleware: جلسة Supabase SSR + اللغة + توجيه المستأجرين.
 * القاعدة الذهبية لمنع "طُردت من الجلسة عند التحديث":
 *  - كل استجابة جديدة (redirect/rewrite) ترث كوكيز supabaseResponse
 *    المجددة من getUser() — لا تُسقط الجلسة المنعشة أبدًا.
 *  - فحص الجلسة على /admin و /login فقط، حتى لا يلمس المنيو العام (ISR).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // تحديث الجلسة (rotate): نكتب الكوكيز على الاستجابة الفعلية
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isLoginPath = pathname === "/login" || pathname.startsWith("/login");
  const locale = pathname.startsWith("/en") ? "en" : "ar";

  // لا نتحقق من الجلسة في الصفحات العامة إطلاقًا (سرعة + ثبات ISR)
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null = null;
  if (isAdminPath || isLoginPath) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  /**
   * إعادة توجيه أو كتابة مع الحفاظ على كوكيز الجلسة:
   * أي استجابة مُسنّدة حديثًا ترث كل ما كُتب على supabaseResponse
   * (للجلسة المنعشة من getUser()) فلا تفقد الجلسة أبدًا.
   */
  const inheritCookies = (res: NextResponse) => {
    res.headers.set("x-locale", locale);
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
  if (isAdminPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return inheritCookies(NextResponse.redirect(url));
  }

  // 3) مسجّل دخول يفتح /login → مباشرة إلى لوحة الإدارة (دون إسقاط الكوكيز)
  if (isLoginPath && user) {
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