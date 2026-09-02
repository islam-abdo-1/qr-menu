# QR Menu — منصة منيو رقمي بأكواد QR (متعدد المطاعم)

Stack: **Next.js 14 (App Router) + TypeScript Strict + Tailwind + Shadcn UI + Prisma + Supabase (PostgreSQL/Auth/Storage) + Vercel**

تطبيقان منفصلان (مشروعا Vercel مستقلان):

| التطبيق | الدور | الرابط |
|---|---|---|
| `qr-menu` (هذا المجلد) | المنيو العام + لوحة المالك + موظفو المطعم + بوابة الدفع | `site-menu.ddnsfree.com` |
| `owner-app` (مجلد شقيق) | لوحة مالك المنصة: إدارة المطاعم/المستخدمين/الفوترة | `owner-qr-menu.vercel.app` |

الميزات:

- منيو عام `/` (عربي RTL) — صفحة **Static/ISR** (إعادة بناء كل 300 ثانية + `revalidateTag` فوري).
- لوحة مالك `/admin` محمية للمطعم نفسه؛ موظفو المطعم عبر `/staff/[slug]` بكود PIN مشترك.
- CRUD للأقسام/العناصر/الطاولات + إخفاء فوري + رفع صور مفروض ضغطه إلى WebP.
- طلبات العملاء مع مضاد تكرار (cartNonce) وكوتا نافذة ذرية (OrderWindow) وتقارير مبيعات (DayStat).
- اشتراكات: تجربة 7 أيام + خطط شهرية/سنوية (Paymob عند التفعيل، أو يدوية من لوحة المالك).
- عرض تجريبي معزول `demo` (قراءة فقط — SEC-004).

---

## 1) إعداد Supabase (مرة واحدة)

1. أنشئ مشروعًا على [supabase.com](https://supabase.com).
2. من **Project Settings → Database**: `DATABASE_URL` (Transaction pooler، منفذ `6543`) و`DIRECT_URL` (Direct، منفذ `5432` — للـ migrations).
3. من **Project Settings → API**: `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. **Authentication → Providers**: فعّل Email (Auto Confirm اختياري — يُفحص بـ `security:auth`).
5. أنشئ bucket عام `menu-images` مع سياسات RLS (لا كتابة لأدوار anon/authenticated — الكتابة service-role حصريًا):

```sql
create policy "public read" on storage.objects
  for select using (bucket_id = 'menu-images');

create policy "menu_images_all_service" on storage.objects
  for all to service_role using (bucket_id = 'menu-images')
  with check (bucket_id = 'menu-images');
```

> التحقق تلقائيًا: `npm run security:probe` — يفحص الجداول الـ16 + سياسات storage + عدم وجود كتابة لـ anon/authenticated.

## 2) إعداد المشروع محليًا

```bash
npm install
copy .env.example .env.local   # ثم حرّر القيم الحقيقية
npm run prisma:migrate         # بناء الجداول (المصدر الوحيد: prisma/migrations)
npm run db:seed                # بيانات تجريبية
npm run dev                    # → http://localhost:3000
```

## 3) النشر على Vercel

1. ارفع المشروع إلى GitHub واستورده في Vercel (التطبيقان منفصلان).
2. أضف نفس متغيرات `.env.local` في **Settings → Environment Variables**.
3. بعد أول نشر: `npx prisma migrate deploy` على قاعدة الإنتاج.
4. `NEXT_PUBLIC_SITE_URL` = رابط الموقع النهائي (يستخدمه رمز QR).
5. أنشئ مستخدم الأدمن من لوحة Supabase، ثم أنشئ `owner-app` للسوبر-أدمن (Super Admin: `SUPER_ADMIN_EMAIL` + مفاتيح Supabase نفسها).

### متغيرات خاصة بالبريد/السر (بلا قيم افتراضية آمنة)

| المتغير | الغرض |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service-role للخادم فقط (حذف صور/مستخدمين، seed) |
| `STAFF_SESSION_SECRET` | توقيع جلسات الموظفين (HMAC) — فشل-مغلق عند غيابه |
| `PURGE_SECRET` | تطهير الكاش بين التطبيقين (POST `/api/purge`) |
| `CRON_SECRET` | حماية مهمة الصيانة `/api/system/clean` (يرسلها Vercel تلقائيًا) |
| `MAIN_SITE_URL` | رابط qr-menu من owner-app (للتطهير) |

---

## قرارات معمارية وأمنية (وثيقة الإسناد)

- **عزل المستأجرات على طبقة التطبيق**: مفتاح «مطعم المالك» يُشتق من هوية الجلسة لكل إجراء (بوابات `lib/authz.ts` فوق `authz-core`)، وكل استعلام يُقيَّد بـ `restaurant.id`/`slug` — قرار واحد مركزي قابل للاختبار.
- **RLS**: كل الجداول مغلقة (لا قراءة/كتابة لـ anon/authenticated)؛ الوصول عبر Prisma بدور `postgres` (المالك الفعلي) — لا service-role على مسار القراءة العام.
- **الجلسات**: فك JWT محلي + تحقق توقيع صفري الشبكة (`lib/jwt.ts`)؛ تجديد refresh في الـ middleware حصرًا (يَمْنع سباق تدوير التوكن)؛ كوكيز HttpOnly + `Secure` في الإنتاج (`lib/session-cookies.ts`).
- **الموظفون**: جلسة HMAC مستقلة (`lib/staff-session.ts`) + إعادة فحص حية للحظر/الاشتراك عند كل استخدام.
- **الديمو**: مستأجر `demo` معزول — رفض خادمي لأي إنشاء طلب/دخول موظفين (SEC-004).
- **الفوترة**: قواعد موحدة في `lib/billing-core.ts` — نسختان متطابقتان حرفيًا في التطبيقين يفرض تطابقهما اختبار (`tests/billing-core.test.ts`).
- **الصيانة**: مهمة يومية `vercel.json` ← `/api/system/clean` (محمية بـ `CRON_SECRET`): احتفاظ لكل جدول، دفعات ≤500 بسقف 20، أخطاء معزولة — خارج مسار إنشاء الطلبات.
- **مصدر الحقيقة للقاعدة**: `prisma/migrations` فقط — يفحصها/يعيد بناءها `security:migrations` (بلا انجراف عن schema.prisma).

---

## الفحوصات والاختبارات

```bash
npm test                     # الوحدات (vitest)
npm run lint && npm run build
npm run security:probe       # RLS + سياسات storage (SEC-003)
npm run security:orders      # مضاد التكرار/الكوتا (SEC-002)
npm run security:payments    # تسوية Paymob (SEC-011)
npm run security:migrations  # مطابقة migrations ↔ schema (SEC-003)
npm run security:auth        # تأكيد البريد/التسجيل (SEC-008)
```

> `owner-app` بلا سكربتات أمان خاصة — مواده خالصة تُختبر من `qr-menu/tests` عبر استيراد نسبي.

## ملاحظات تقنية

- **الأداء**: المنيو العام كاش ISR 300 ثانية — آلاف الزوار لا يلمسون القاعدة عند أي طلب.
- **الأمان**: `SUPABASE_SERVICE_ROLE_KEY` لا يصل للمتصفح أبدًا؛ الأسرّ كلها في `.env*.local` (مستثناة من git).
- **الترخيص**: إخفاء عنصر = اختفاء فوري من العامة؛ حذف قسم يحذف صور عناصره من Storage.