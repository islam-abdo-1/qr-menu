import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "crypto";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

/** كود موظفين عشوائي — لا تُطبع أي بيانات اعتماد ثابتة/معروفة في أي مكان (SEC-004) */
const randomStaffPin = () => String(randomInt(1000, 10000));

const CATEGORIES = [
  {
    name: "مشويات",
    sortOrder: 1,
    items: [
      { name: "كباب بلدي", description: "كباب لحم بلدي طازج على الفحم يُقدَّم مع أرز وبقدونس", price: 180 },
      { name: "كفتة لحم", description: "كفتة مشوية متبَّلة بالبهارات المصرية المشهورة", price: 150 },
      { name: "شيش طاووق", description: "قطع دجاج متبّلة مشوية مع خضار سوتيه", price: 160 },
    ],
  },
  {
    name: "مقبلات",
    sortOrder: 2,
    items: [
      { name: "فتوش", description: "خضار طازجة مع خبز محمص وصلصة الليمون", price: 60 },
      { name: "متبل", description: "باذنجان مشوي مع الطحينة والزيت البلدي", price: 45 },
    ],
  },
  {
    name: "أطباق رئيسية",
    sortOrder: 3,
    items: [
      { name: "فرخة شواية", description: "نصف فرخة متبّلة بالليمون والثوم على الشواية", price: 200 },
      { name: "بفتيك مكرونة", description: "شرائح بفتيك بصلصة الطماطم مع المكرونة", price: 130 },
    ],
  },
  {
    name: "حلويات",
    sortOrder: 4,
    items: [
      { name: "أم علي", description: "حلوى تقليدية دافئة بالمكسرات والقشطة", price: 55 },
      { name: "مهلبية", description: "مهلبية باردة بالقشطة والمكسرات", price: 40 },
    ],
  },
];

async function main() {
  // امسح البيانات القديمة
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.restaurant.deleteMany();

  // مستأجران للبيئة التطويرية:
  //  1) kafy — مطعم حقيقي بمالك (DEMO_OWNER_ID أو معرفك الفعلي من Supabase)
  //  2) demo — العرض التجريبي العام: بلا مالك (ownerId placeholder بلا حساب)،
  //     بكود موظفين عشوائي غير معلوم، ومُعفى من الفوترة — قراءة فقط (SEC-004)
  const demoOwnerId = process.env.DEMO_OWNER_ID ?? "demo-owner";
  const restaurants = [
    {
      slug: "kafy",
      name: "مطعم أبو القوة",
      ownerId: demoOwnerId,
      staffPin: randomStaffPin(),
    },
    {
      slug: "demo",
      name: "مطعم أبو القوة (تجريبي)",
      ownerId: "demo-owner-2",  // Different ownerId to avoid unique constraint conflict
      staffPin: randomStaffPin(),
      billingExempt: true,
    },
  ];

  for (const r of restaurants) {
    const restaurant = await prisma.restaurant.create({
      data: {
        slug: r.slug,
        name: r.name,
        ownerId: r.ownerId,
        staffPin: r.staffPin,
        billingExempt: r.billingExempt ?? false,
      },
    });

    // الإعدادات
    await prisma.setting.create({
      data: {
        restaurantId: restaurant.id,
        restaurantName: r.name,
        currency: "EGP",
        themePrimary: "#C84C21",
        logoPublicId: null,
        logoWidth: null,
        logoHeight: null,
        logoSizeKB: null,
      },
    });

    // الأقسام والعناصر
    for (const cat of CATEGORIES) {
      await prisma.category.create({
        data: {
          name: cat.name,
          sortOrder: cat.sortOrder,
          restaurantId: restaurant.id,
          items: {
            create: cat.items.map((item) => ({ ...item, restaurantId: restaurant.id })),
          },
        },
      });
    }
  }

  // إنشاء bucket عام للصور من لوحة Supabase إن وُجدت المفاتيح
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (NEXT_PUBLIC_SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const bucketName = "menu-images";
    const { data: bucket } = await admin.storage.getBucket(bucketName);
    if (!bucket) {
      await admin.storage.createBucket(bucketName, { public: true });
      console.log(`تم إنشاء bucket عام: ${bucketName}`);
    }
  } else {
    console.log("ℹ️  أدخل SUPABASE_SERVICE_ROLE_KEY لإنشاء bucket تلقائيًا، أو أنشئ bucket 'menu-images' يدويًا.");
  }

  console.log("✅ اكتملت الطباعة التجريبية.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });