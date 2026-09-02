-- ككشفت سياسات حية أوسع من المكتوبة في README: كان دور anon (بدون أي تسجيل)
-- يملك insert/update/delete على أي ملف في bucket 'menu-images' — و authenticated
-- بالمثل على ملفات كل المطاعم. كل الكتابة تتم الآن عبر service-role من
-- Server Actions، فالسياسات التالية تُسقط بالكامل ويبقى القراءة العامة فقط:

drop policy if exists "menu_images_insert" on storage.objects;
drop policy if exists "menu_images_update" on storage.objects;
drop policy if exists "menu_images_delete" on storage.objects;
drop policy if exists "menu_images_insert_auth" on storage.objects;
drop policy if exists "menu_images_update_auth" on storage.objects;
drop policy if exists "menu_images_delete_auth" on storage.objects;