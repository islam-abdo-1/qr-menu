import "server-only";
import { prisma } from "@/lib/prisma";

/** حجم الصفحة للتصدير المباشر — يبقي الذاكرة محدودة مهما كبرت البيانات (SEC-012) */
export const EXPORT_PAGE_SIZE = 1000;

export const CSV_HEADER = '"Name","Phone"';

/**
 * تنظيف نص خلية CSV + تحييد حقن الصيغ (CSV injection):
 * قيمة تبدأ بـ = + - @ تُنفَّذ كصيغة في Excel/Sheets فتُسبق بعلامة اقتباس مفرد.
 */
export function csvCell(value: string): string {
  let cleaned = value.replace(/[\r\n,"]/g, " ").trim();
  if (/^[=+\-@\t].*/.test(cleaned)) cleaned = `'${cleaned}`;
  return `"${cleaned}"`;
}

export type ExportRow = { customerName: string; phone: string | null };

/**
 * إضافة أسطر CSV بعد إزالة تكرار الأرقام (آخر اسم لكل رقم — الترتيب أحدث أولًا).
 * ناتج ملهِد: يُصفَّى في `lines`، ويعيد مخزون الأرقام للصفحة التالية.
 */
export function appendDeduplicated(
  rows: ExportRow[],
  seen: Map<string, string>,
  lines: string[],
): void {
  for (const r of rows) {
    const phone = r.phone?.trim();
    if (!phone) continue;
    if (seen.has(phone)) continue;
    seen.set(phone, r.customerName);
    lines.push(`${csvCell(r.customerName)},${csvCell(phone)}`);
  }
}

/**
 * تصدير عملاء التوصيل كتدفق (stream) بتصفح صفحي (cursor):
 *  - ذاكرة محدودة: صفحة واحدة في كل مرة، والاستجابة تُبثّ قطعًا — لا يُبنى CSV كامل في الذاكرة.
 *  - نفس النتيجة السابقة حرفيًا: الترتيب أحدث أولًا + أول ظهور لكل رقم (الأحدث).
 */
export function createCustomersCsvStream(restaurantId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cursor: { createdAt: Date; id: string } | null = null;
  const seen = new Map<string, string>();
  let first = true;
  let closed = false;
  const chunkSize = 64 * 1024;
  let buffered = "";

  const emit = (controller: ReadableStreamDefaultController<Uint8Array>, text: string): void => {
    buffered += text;
    if (buffered.length >= chunkSize) {
      controller.enqueue(encoder.encode(buffered));
      buffered = "";
    }
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (closed) {
        if (buffered) controller.enqueue(encoder.encode(buffered));
        controller.close();
        return;
      }
      const page = await prisma.order.findMany({
        where: {
          restaurantId,
          type: "delivery",
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        select: { customerName: true, phone: true, id: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: EXPORT_PAGE_SIZE,
      });
      if (page.length === 0) {
        closed = true;
        if (buffered) controller.enqueue(encoder.encode(buffered));
        controller.close();
        return;
      }
      const last = page[page.length - 1];
      cursor = { createdAt: last.createdAt, id: last.id };

      const lines: string[] = [];
      if (first) {
        lines.push(`\uFEFF${CSV_HEADER}`);
        first = false;
      }
      appendDeduplicated(page, seen, lines);
      emit(controller, lines.length ? `${lines.join("\r\n")}\r\n` : "");
    },
  });
}