import { describe, expect, it, vi } from "vitest";
import { daysAgo } from "../lib/time";
import {
  CHUNK_SIZE,
  MAX_CHUNKS_PER_TABLE,
  RETENTION_DAYS,
  runMaintenance,
  type MaintenanceDb,
} from "../lib/maintenance";

const NOW = new Date("2026-08-14T00:00:00Z");

const rows = (n: number): { id: string }[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));

function fakeDb(overrides: Partial<MaintenanceDb> = {}): MaintenanceDb {
  return {
    order: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    orderWindow: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    auditLog: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    ownerLoginAttempt: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    payment: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    dayStat: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    ...overrides,
  };
}

describe("SEC-015: صيانة مجدولة — حدود الدفعات والاحتفاظ والعزل", () => {
  it("التنظيف مقيد بالدفعات: سقف MAX_CHUNKS_PER_TABLE يوقف الدورة حتى مع تكرار البيانات", async () => {
    const findMany = vi.fn(async () => rows(CHUNK_SIZE)); // دائمًا دفعة كاملة
    const deleteMany = vi.fn(async () => ({ count: CHUNK_SIZE }));
    const db = fakeDb({ order: { findMany, deleteMany } });
    const r = await runMaintenance(db, NOW);
    expect(findMany).toHaveBeenCalledTimes(MAX_CHUNKS_PER_TABLE);
    expect(r.tables.find((t) => t.table === "orders")?.deleted).toBe(CHUNK_SIZE * MAX_CHUNKS_PER_TABLE);
    expect(r.ok).toBe(true);
  });

  it("يتوقف عند دفعة ناقصة (لا شيء متبقٍ) — بلا لمس زيادة", async () => {
    const findMany = vi.fn(async () => rows(3));
    const deleteMany = vi.fn(async () => ({ count: 3 }));
    const db = fakeDb({ order: { findMany, deleteMany } });
    const r = await runMaintenance(db, NOW);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(r.total).toBe(3);
  });

  it("idempotent: إعادة التشغيل دون بيانات تطابق لا تحذف شيئًا", async () => {
    const findMany = vi.fn(async () => []);
    const db = fakeDb({ order: { findMany, deleteMany: vi.fn(async () => ({ count: 0 })) } });
    const r = await runMaintenance(db, NOW);
    expect(r.total).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("فشل جدول واحد لا يوقف الباقي — الفشل يُقاس في errors", async () => {
    const db = fakeDb({
      auditLog: {
        findMany: async () => {
          throw new Error("connect ECONNREFUSED");
        },
        deleteMany: async () => ({ count: 0 }),
      },
    });
    const r = await runMaintenance(db, NOW);
    expect(r.ok).toBe(false);
    expect(r.errors.auditLogs).toContain("ECONNREFUSED");
    // بقية الجداول عولجت رغم الفشل
    expect(r.tables.length).toBe(5);
  });

  it("الاحتفاظ بحدود التسامح الصحيحة لكل جدول (سياسة منفصلة)", async () => {
    const cutoffs: Record<string, unknown> = {};
    const db = fakeDb({
      order: {
        findMany: vi.fn(async (args: any) => { cutoffs.orders = args.where.createdAt.lt; return []; }),
        deleteMany: async () => ({ count: 0 }),
      },
      orderWindow: {
        findMany: vi.fn(async (args: any) => { cutoffs.orderWindow = args.where.windowStart.lt; return []; }),
        deleteMany: async () => ({ count: 0 }),
      },
      auditLog: {
        findMany: vi.fn(async (args: any) => { cutoffs.auditLog = args.where.createdAt.lt; return []; }),
        deleteMany: async () => ({ count: 0 }),
      },
      dayStat: {
        findMany: vi.fn(async (args: any) => { cutoffs.dayStat = args.where.date.lt; return []; }),
        deleteMany: async () => ({ count: 0 }),
      },
      payment: {
        findMany: vi.fn(async (args: any) => {
          cutoffs.payment = { status: args.where.status, lt: args.where.createdAt.lt };
          return [];
        }),
        deleteMany: async () => ({ count: 0 }),
      },
    });
    await runMaintenance(db, NOW);
    expect(cutoffs.orders).toEqual(daysAgo(NOW, RETENTION_DAYS.orders));
    expect(cutoffs.orderWindow).toEqual(daysAgo(NOW, RETENTION_DAYS.orderWindow));
    expect(cutoffs.auditLog).toEqual(daysAgo(NOW, RETENTION_DAYS.auditLog));
    expect(cutoffs.dayStat).toEqual(daysAgo(NOW, RETENTION_DAYS.dayStat));
    expect((cutoffs.payment as any).lt).toEqual(daysAgo(NOW, RETENTION_DAYS.stalePayment));
    expect((cutoffs.payment as any).status).toEqual({ in: ["pending", "failed"] });
  });

  it("النوافذ/الأسطر الزمنية تُرتب بعمودها الزمني الصحيح (لا createdAt)", async () => {
    const orders: Record<string, unknown>[] = [];
    const db = fakeDb({
      orderWindow: {
        findMany: vi.fn(async (args: any) => {
          orders.push(args.orderBy);
          return [];
        }),
        deleteMany: async () => ({ count: 0 }),
      },
      dayStat: {
        findMany: vi.fn(async (args: any) => {
          orders.push(args.orderBy);
          return [];
        }),
        deleteMany: async () => ({ count: 0 }),
      },
    });
    await runMaintenance(db, NOW);
    expect(orders[0]).toEqual({ windowStart: "asc" });
    expect(orders[1]).toEqual({ date: "asc" });
  });

  it("محاولات الدخول الناجحة تُمسح بسياسة أسرع من الباقي", async () => {
    const wheres: Record<string, unknown>[] = [];
    const db = fakeDb({
      ownerLoginAttempt: {
        findMany: vi.fn(async (args: any) => {
          wheres.push(args.where);
          return args.where.success ? rows(2) : [];
        }),
        deleteMany: vi.fn(async () => ({ count: 2 })),
      },
    });
    const r = await runMaintenance(db, NOW);
    expect(wheres[0]).toMatchObject({ success: true });
    expect((wheres[0].createdAt as any).lt).toEqual(daysAgo(NOW, RETENTION_DAYS.ownerLoginAttemptSuccess));
    expect((wheres[1].createdAt as any).lt).toEqual(daysAgo(NOW, RETENTION_DAYS.ownerLoginAttempt));
    expect(r.tables.find((t) => t.table === "ownerLoginAttempts")?.deleted).toBe(2);
  });
});