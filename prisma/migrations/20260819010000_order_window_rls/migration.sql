-- SEC-017: إحكام RLS على جدول العدّاد الجديد OrderWindow — يتبع نمط القفل الشامل:
-- RLS مفعّل بلا سياسات (deny-by-default) + سحب الامتيازات من الأدوار العامة. idempotent.

ALTER TABLE "OrderWindow" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "OrderWindow" FROM anon;
REVOKE ALL ON "OrderWindow" FROM authenticated;