CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 1;
SELECT setval('order_number_seq', COALESCE((SELECT MAX(number) FROM "Order"), 0), true);
