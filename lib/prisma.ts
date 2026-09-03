import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

/**
 * Singleton آمن لبيئة Vercel Serverless + Supabase (PgBouncer/transactional pooling):
 *
 * 1. إعادة الاستخدام بين الـ Lambdas الدافئة (globalThis): إنشاء PrismaClient
 *    جديد لكل طلب هو السبب الأول لاستنفاد مجمع الاتصالات في Supabase —
 *    كل عميل يفتح Poolاً كاملًا؛ هنا عميل واحد عالمي مشترك.
 * 2. بركة pg مقيدة (PRISMA_POOL_SIZE، افتراضي 2) ولا تزيد أبدًا تلقائيًا —
 *    فالاتصالات على خدمة PgBouncer تُستهلك من مجمع مشترك (سقفه ~200)
 *    على مستوى حساب المشروع بأكمله.
 * 3. مهلات آمنة: عدم التعليق بلا نهاية في قائمة انتظار (connectionTimeoutMillis)
 *    وتحرير الخامل قبل أن تكتظ الحوادث الدافئة (idleTimeoutMillis).
 *
 * ملاحظة: طبقتنا تستخدم PgBouncer في وضع Transaction pooling — كل استعلام يحصل
 * على اتصال مخصص ثم يُحرر فورًا؛ فلا قلق من الصفقات الطويلة ولا تفاوت الاتصالات.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const poolSize = Number.parseInt(process.env.PRISMA_POOL_SIZE ?? "20", 10);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    max: poolSize,
    connectionTimeoutMillis: 10_000, // لا تنتظر أكثر من 10s ثم ترمي خطأً واضحًا
    idleTimeoutMillis: 30_000, // حرر الاتصال الخامل بعد 30s
    maxUses: 50_000, // تجديد الاتصالات القديمة تلقائيًا (استقرار طويل الأمد)
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"], // لا تُحمّل الإنتاج بصدار Debug (أداء + خصوصية)
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// الحفاظ على نفس المثيل أثناء التطوير/البناء السريع (fast refresh)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}