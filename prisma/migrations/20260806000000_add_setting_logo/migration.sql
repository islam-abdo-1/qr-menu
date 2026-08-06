-- محاذاة تاريخ الهجرة مع القاعدة الحالية:
-- عمود logoUrl أُضيف يدويًا في القاعدة (بدون migration) — هنا يُسجَّل في التاريخ فقط.
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT DEFAULT '';
