-- تحصين RLS: تغطية كل الجداول المتبقية + إلغاء الصلاحيات الافتراضية
-- (الموقع لا يستخدم PostgREST إطلاقًا — كل القراءة/الكتابة عبر Prisma من الخادم)

ALTER TABLE public."SiteSetting"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OwnerLoginAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Staff"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Table"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DayStat"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuItemSize"      ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON public."SiteSetting"       FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."AuditLog"          FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."OwnerLoginAttempt" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Payment"           FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Staff"             FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Table"             FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."DayStat"           FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."MenuItemSize"      FROM anon, authenticated;

REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

-- منع أي جدول مستقبلي من العودة إلى الصلاحيات العامة تلقائيًا
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;