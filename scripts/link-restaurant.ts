#!/usr/bin/env npx tsx
/**
 * سكربت ربط مطعم بمالك حقيقي
 * الاستخدام: npx tsx scripts/link-restaurant.ts <email> <slug>
 * مثال: npx tsx scripts/link-restaurant.ts islam@example.com kafy
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("❌ الاستخدام: npx tsx scripts/link-restaurant.ts <email> <slug>");
    console.error("   مثال: npx tsx scripts/link-restaurant.ts islam@example.com kafy");
    process.exit(1);
  }

  const [email, slug] = args;
  const normalizedEmail = email.toLowerCase().trim();

  console.log(`🔍 جاري البحث عن المستخدم: ${normalizedEmail}`);

  // البحث عن المستخدم في Supabase Auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("❌ متغيرات Supabase غير موجودة في .env.local");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // البحث بالبريد الإلكتروني
  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    console.error("❌ فشل جلب المستخدمين:", listError.message);
    process.exit(1);
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === normalizedEmail);

  if (!user) {
    console.error(`❌ لم يتم العثور على مستخدم بالبريد: ${normalizedEmail}`);
    console.log("\n👥 المستخدمون الموجودون:");
    usersData.users.forEach((u) => console.log(`   - ${u.email} (${u.id})`));
    process.exit(1);
  }

  console.log(`✅ تم العثور على المستخدم: ${user.email} (${user.id})`);

  // البحث عن المطعم
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });

  if (!restaurant) {
    console.error(`❌ لم يتم العثور على مطعم بالـ slug: ${slug}`);
    const restaurants = await prisma.restaurant.findMany({ select: { slug: true, name: true, ownerId: true } });
    console.log("\n🏪 المطاعم الموجودة:");
    restaurants.forEach((r) => console.log(`   - ${r.slug} (${r.name}) — ownerId: ${r.ownerId}`));
    process.exit(1);
  }

  console.log(`🏪 المطعم: ${restaurant.name} (${restaurant.slug}) — ownerId الحالي: ${restaurant.ownerId}`);

  if (restaurant.ownerId === user.id) {
    console.log("ℹ️ المطعم مربوط بالفعل بهذا المستخدم. لا حاجة للتغيير.");
    return;
  }

  // تحديث ownerId
  await prisma.restaurant.update({
    where: { slug },
    data: { ownerId: user.id },
  });

  console.log(`✅ تم تحديث ownerId من ${restaurant.ownerId} إلى ${user.id}`);
  console.log("🎉 يمكنك الآن تسجيل الدخول وإدارة المطعم من لوحة الإدارة.");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });