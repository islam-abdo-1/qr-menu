# QR Menu — نظام منيو رقمي بأكواد QR لمطعم واحد

Stack: **Next.js 14 (App Router) + TypeScript Strict + Tailwind + Shadcn UI + Prisma + Supabase (PostgreSQL/Auth/Storage) + Vercel**

الميزات:
- منيو عام `/` (عربي RTL) و `/en` (إنجليزي) — **صفحات Static/ISR**: تُبنى مرة واحدة ولا تلمس قاعدة البيانات عند أي طلب.
- لوحة إدارة `/admin` محمية بالكامل (middleware + فحص جلسة على الخادم) — لا توجد أي روابط لها من المنيو العام.
- CRUD كامل للأقسام والعناصر + إخفاء/إظهار فوري (RevalidateTag).
- رفع صور مضغوطة تلقائيًا إلى **WebP** عبر Supabase Storage، وعرضها بـ `next/image`.
- توليد رمز QR للمنيو مع تحميل PNG عالي الدقة للطباعة.
- تحقق `zod` من كل المدخلات + تعقيم النصوص (حماية XSS/حقن).

---

## 1) إعداد Supabase (مرة واحدة)

1. أنشئ مشروعًا على [supabase.com](https://supabase.com).
2. من **Project Settings → Database** خذ:
   - `DATABASE_URL`: رابط **Transaction pooler** (منفذ `6543`).
   - `DIRECT_URL`: رابط **Direct connection** (منفذ `5432`) — للـ migrations محليًا.
3. من **Project Settings → API** خذ `NEXT_PUBLIC_SUPABASE_URL` و `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. من **Authentication → Providers** تأكد أن **Email** مفعّل، ثم أنشئ مستخدم أدمن: **Authentication → Users → Add user** (البريد + كلمة مرور من 8 أحرف).
5. أنشئ **bucket عام** باسم `menu-images` (Storage → New bucket → Public).
6. أضف سياسات RLS لرفع الصور (SQL Editor):

```sql
-- قراءة عامة للصور
create policy "public read" on storage.objects
  for select using (bucket_id = 'menu-images');

-- رفع/حذف/تحديث من المستخدم المسجّل فقط
create policy "auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'menu-images');
create policy "auth update" on storage.objects
  for update to authenticated using (bucket_id = 'menu-images');
create policy "auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'menu-images');
```

## 2) إعداد المشروع محليًا

```bash
npm install
# انسخ قالب المتغيرات واملأه بقيمك الحقيقية
copy .env.example .env.local
# ثم حرّر .env.local

# إنشاء الجداول في قاعدة البيانات + بيانات تجريبية
npm run prisma:migrate
npm run db:seed

npm run dev   # → http://localhost:3000
```

- المنيو العام: `http://localhost:3000` — لوحة الإدارة: `http://localhost:3000/admin` — الدخول: `http://localhost:3000/login`.

## 3) النشر على Vercel

1. ارفع المشروع إلى GitHub ثم استورده في Vercel.
2. أضف نفس المتغيرات من `.env.local` في **Settings → Environment Variables** (بما فيها `DATABASE_URL` و `DIRECT_URL`).
3. في **Settings → Build**:
   - Install Command: `npm install`
   - Build Command: `npm run build`
4. بعد أول نشر ناجح، نفّذ المهاجرة على قاعدة الإنتاج من جهازك:
   ```bash
   npx prisma migrate deploy
   ```
5. ضع `NEXT_PUBLIC_SITE_URL` = رابط موقعك النهائي (يستخدمه رمز QR).
6. أنشئ مستخدم الأدمن من لوحة Supabase كما في الخطوة 4 أعلاه.

## ملاحظات تقنية

- **الأداء**: المنيو العام صفحة Static تُعاد إنشاؤها كل 300 ثانية، وبياناته في كاش `revalidateTag('menu')` يُمسح فور أي تعديل من الأدمن — آلاف الزوار المتزامنون لا يضربون قاعدة البيانات إطلاقًا.
- **الأمان**: لا تكشف `SUPABASE_SERVICE_ROLE_KEY` أبدًا للمتصفح (تُستخدم فقط في seed). المتغيرات الحقيقية في `.env.local` فقط (مستثنى من git).
- **الترخيص**: إخفاء عنصر = يختفي فورًا من العامة؛ حذف قسم يحذف صور عناصره من Storage.
