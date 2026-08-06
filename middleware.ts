import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware السجلان:
 *  1. تحديد locale (عربي افتراضي / إيمجو EN عبر /en).
 *  2. إغلاق مسارات /admin خلف بوابة الدخول — بلا جلسة صالحة => إعادة توجيه /login.
 * ملاحظة أداء مهمة: تفحص الجلسة يحدث فقط على /admin و /login،
 *  حتى لا يرتطم استدعاء خارجي بصفحة المنيو العامة (الثبات للـ ISR).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
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

  // الصفحات العامة — لا نتحقق من الجلسة إطلاقًا (الصغر والسرعة).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] | null = null;
  if (isAdminPath || isLoginPath) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  // إعداد اللغة (arabic افتراضي، en عندما يبدأ المسار بـ /en)
  supabaseResponse.headers.set("x-locale", pathname.startsWith("/en") ? "en" : "ar");

  // حماية لوحة الأدمن: بدون جلسة => انتقال إلى /login
  if (isAdminPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // إن كان مسجّل الدخول يفتح /login => توجيه مباشرة للمشرف
  if (isLoginPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

export default updateSession;