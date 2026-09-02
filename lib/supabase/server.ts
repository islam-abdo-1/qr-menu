import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSessionCookieOptions } from "@/lib/session-cookies";

/** خيارات كوكي الجلسة الموحدة — «تذكرني»: تبقى 30 يومًا بعد إغلاق المتصفح + Secure في الإنتاج (SEC-009) */
const COOKIE_OPTIONS = getSessionCookieOptions(60 * 60 * 24 * 30);

/**
 * Supabase client للاستخدام على الخادم (Server Actions / Route Handlers / Server Components).
 * - الجلسة محمولة في Cookies آمنة (HttpOnly) فقط — لا localStorage إطلاقًا.
 * - autoRefreshToken: عند انتهاء access token، يقوم getUser() بتجديده عبر refresh token.
 * - كتابة الكوكيز: تعمل داخل Server Actions/Route Handlers؛ أما داخل Server Components
 *   فيرفضها Next (الكوكيز للقراءة فقط) — وهو متوقّع ومُعالج عبر تحديث الجلسة في middleware
 *   الذي يعمل على كل طلب للمسارات المحمية قبل وصوله للمكونات.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      cookieOptions: COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // يُستدعى من Server Component (قراءة فقط) —
            // التجديد يتم فعلًا في الـ middleware قبل وصول الطلب إلى هنا.
          }
        },
      },
    },
  );
}