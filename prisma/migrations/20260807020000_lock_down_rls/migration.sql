-- إحكام الأمان: التطبيق يصل للبيانات عبر Prisma فقط (دور postgres يتجاوز RLS).
-- نفعّل RLS على كل الجداول بدون أي policies (الرفض الافتراضي) ونسحب صلاحيات
-- anon/authenticated حتى لا يستطيع أحد الوصول لأي صف عبر Data API (PostgREST).

ALTER TABLE public."Restaurant"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Setting"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Category"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MenuItem"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Favorite"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON public."Restaurant"      FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Setting"         FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Category"        FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."MenuItem"        FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Favorite"        FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."Order"           FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."OrderItem"       FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON public."_prisma_migrations" FROM anon, authenticated;
