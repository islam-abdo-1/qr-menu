-- وقت تسليم الطلب (يُملأ تلقائيًا عند تغيير الحالة إلى done)
ALTER TABLE "Order" ADD COLUMN "completedAt" TIMESTAMP(3);
