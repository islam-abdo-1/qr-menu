CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 1;
-- SEC-003: GREATEST(...,1) يمنع فشل إعادة الإنتاج على قاعدة فارغة — setval(0) خارج الحدود
-- (البيئة الحية تحوي طلبات لذا MAX>=1؛ القاعدة الجديدة كانت تفشل عند التشغيل من الصفر)
SELECT setval('order_number_seq', GREATEST(COALESCE((SELECT MAX(number) FROM "Order"), 0), 1), false);
