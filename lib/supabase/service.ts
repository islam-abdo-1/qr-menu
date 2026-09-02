import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client بـ service-role key — للخادم فقط (Server Actions / Route Handlers).
 * يُستخدم حصريًا لعمليات Storage (رفع/حذف الصور) التي تتجاوز RLS بتفويض المنصة
 * وليس بجلسة المستخدم — يتيح إسقاط سياسات `authenticated` العريضة التي كانت
 * تسمح لأي مستخدم مسجّل بالكتابة على ملفات أي مطعم.
 */
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
