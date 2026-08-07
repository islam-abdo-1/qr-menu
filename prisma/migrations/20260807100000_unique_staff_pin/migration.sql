-- كود دخول الموظفين فريد لكل مطعم (الفارغ "" مسموح بتكراره — مطاعم غير مفعّلة)
CREATE UNIQUE INDEX "Restaurant_staffPin_unique_idx" ON "Restaurant"("staffPin") WHERE "staffPin" <> '';
