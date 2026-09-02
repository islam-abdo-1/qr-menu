-- إغلاق سياسات storage.objects العريضة (ثغرة الاستضافة المتقاطعة):
-- كانت `auth insert/update/delete where bucket_id='menu-images'` تسمح لأي
-- مستخدم مسجّل (حتى حساب زبون مجاني) برفع/تعديل/حذف ملفات أي مطعم آخر
-- عبر Storage API مباشرةً — بجانب استضافة محتوى عشوائي على دومين المنصة.
--
-- كل عمليات الكتابة (رفع/حذف الصور) تتم الآن حصريًا من Server Actions
-- عبر service-role التي تتجاوز RLS بتفويض المنصة — فلا حاجة لأي سياسة authenticated.

drop policy if exists "auth insert" on storage.objects;
drop policy if exists "auth update" on storage.objects;
drop policy if exists "auth delete" on storage.objects;

-- القراءة العامة تبقى فقط (الباكت عام للعرض عبر الروابط المباشرة)
drop policy if exists "public read" on storage.objects;
create policy "public read" on storage.objects
  for select using (bucket_id = 'menu-images');