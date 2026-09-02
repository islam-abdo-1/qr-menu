/**
 * SEC-015 — صيانة دورية مجدولة خارج مسار الطلبات المباشر.
 * احتفاظ لكل جدول حسب سياسته، دفعات محدودة، معالجة أخطاء معزولة (فشل جدول
 * لا يوقف الباقي)، نتيجة قابلة للملاحظة لكل جدول — وقابل للحقن لاختبار الوحدة.
 */
import { daysAgo } from "@/lib/time";

export const CHUNK_SIZE = 500; // أقصى حذف في دفعة واحدة
export const MAX_CHUNKS_PER_TABLE = 20; // سقف صارم للدفعات لكل جدول في كل تشغيل

export const RETENTION_DAYS = {
  orders: 30, // مكتملة فقط — التقارير اليومية محفوظة في DayStat
  orderWindow: 7, // نوافذ منتهية (العدّاد يقرأ النافذة الحالية فقط) — 7 أيام للأمان
  auditLog: 180, // أرشيف إجراءات المالك — 6 أشهر
  ownerLoginAttempt: 90, // أساس قفل التخمين نافذته 15 دقيقة فقط
  ownerLoginAttemptSuccess: 1, // الناجحة لا تفيد القفل — تُمسح سريعًا
  stalePayment: 30, // pending/failed قديمة بلا فائدة مالية
  dayStat: 730, // إجماليات يومية — سنتان (التقارير الشهرية/السنوية لا تتجاوزها)
} as const;

export interface MaintenanceDb {
  order: { findMany(args: unknown): Promise<{ id: string }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  // المفتاح المركب [restaurantId, windowStart] — يُحذف عبر OR بمفاتيح أولية
  orderWindow: { findMany(args: unknown): Promise<{ restaurantId: string; windowStart: Date }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  auditLog: { findMany(args: unknown): Promise<{ id: string }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  ownerLoginAttempt: { findMany(args: unknown): Promise<{ id: string }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  payment: { findMany(args: unknown): Promise<{ id: string }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
  dayStat: { findMany(args: unknown): Promise<{ id: string }[]>; deleteMany(args: unknown): Promise<{ count: number }> };
}

export type MaintenanceResult = {
  ok: boolean;
  total: number;
  tables: { table: string; deleted: number }[];
  errors: Record<string, string>;
};

/**
 * حذف محدود الدفعات: يقرأ أقدم صفوف تطابق الشرط (CHUNK_SIZE) ثم يحذفها
 * بمعرّفاتها الأولية، ويتوقف فور نقصان الدفعة أو بلوغ سقف الدفعات — صارم وبلا حلقة لا نهائية.
 */
async function deleteChunked(
  findMany: (args: unknown) => Promise<Record<string, unknown>[]>,
  deleteMany: (args: unknown) => Promise<{ count: number }>,
  where: Record<string, unknown>,
  idField: string | string[],
  orderByField: string = "createdAt",
): Promise<number> {
  const keyOf = (row: Record<string, unknown>): unknown =>
    Array.isArray(idField) ? Object.fromEntries(idField.map((f) => [f, row[f]])) : row[idField];
  let deleted = 0;
  for (let i = 0; i < MAX_CHUNKS_PER_TABLE; i++) {
    const select = Array.isArray(idField)
      ? Object.fromEntries(idField.map((f) => [f, true]))
      : { id: true };
    const rows = await findMany({ where, take: CHUNK_SIZE, select, orderBy: { [orderByField]: "asc" } });
    if (!rows.length) break;
    const { count } = await deleteMany({ where: { OR: rows.map((r) => ({ id: keyOf(r) })) } });
    deleted += count;
    if (rows.length < CHUNK_SIZE) break; // لم يتبقَّ شيء ضمن الشرط
  }
  return deleted;
}

export async function runMaintenance(
  db: MaintenanceDb,
  now: Date,
  limits: Partial<typeof RETENTION_DAYS> = {},
): Promise<MaintenanceResult> {
  const keep = { ...RETENTION_DAYS, ...limits };
  const tables: { table: string; deleted: number }[] = [];
  const errors: Record<string, string> = {};

  const tasks: { table: string; run: () => Promise<number> }[] = [
    {
      table: "orders",
      run: () =>
        deleteChunked(
          db.order.findMany,
          db.order.deleteMany,
          { status: "done", createdAt: { lt: daysAgo(now, keep.orders) } },
          "id",
        ),
    },
    {
      table: "orderWindows",
      run: () =>
        deleteChunked(
          db.orderWindow.findMany,
          db.orderWindow.deleteMany,
          { windowStart: { lt: daysAgo(now, keep.orderWindow) } },
          ["restaurantId", "windowStart"],
          "windowStart", // لا عمود createdAt — الترتيب بنافذة البداية
        ),
    },
    {
      table: "auditLogs",
      run: () =>
        deleteChunked(
          db.auditLog.findMany,
          db.auditLog.deleteMany,
          { createdAt: { lt: daysAgo(now, keep.auditLog) } },
          "id",
        ),
    },
    {
      table: "ownerLoginAttempts",
      run: async () => {
        // الناجحة تُمسح سريعًا (بلا قيمة لقفل التخمين) ثم الباقي بعد السقف العام
        let n = await deleteChunked(
          db.ownerLoginAttempt.findMany,
          db.ownerLoginAttempt.deleteMany,
          { success: true, createdAt: { lt: daysAgo(now, keep.ownerLoginAttemptSuccess) } },
          "id",
        );
        n += await deleteChunked(
          db.ownerLoginAttempt.findMany,
          db.ownerLoginAttempt.deleteMany,
          { createdAt: { lt: daysAgo(now, keep.ownerLoginAttempt) } },
          "id",
        );
        return n;
      },
    },
    {
      table: "stalePayments",
      run: () =>
        deleteChunked(
          db.payment.findMany,
          db.payment.deleteMany,
          { status: { in: ["pending", "failed"] }, createdAt: { lt: daysAgo(now, keep.stalePayment) } },
          "id",
        ),
    },
    {
      table: "dayStats",
      run: () =>
        deleteChunked(
          db.dayStat.findMany,
          db.dayStat.deleteMany,
          { date: { lt: daysAgo(now, keep.dayStat) } },
          "id",
          "date", // لا عمود createdAt — الترتيب باليوم
        ),
    },
  ];

  for (const task of tasks) {
    try {
      const deleted = await task.run();
      tables.push({ table: task.table, deleted });
    } catch (e) {
      // فشل جدول لا يوقف بقية الجدولة — الفشل يُقاس في النتيجة (SEC-015: failure-aware)
      errors[task.table] = e instanceof Error ? e.message : String(e);
    }
  }

  return { ok: Object.keys(errors).length === 0, total: tables.reduce((s, t) => s + t.deleted, 0), tables, errors };
}