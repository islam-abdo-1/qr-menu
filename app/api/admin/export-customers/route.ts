import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";

/**
 * تصدير عملاء المطعم إلى CSV — لأغراض تسويق WhatsApp.
 * الحماية: نفس جلسة الأدمن (cookies) — مالك المطعم فقط.
 * ملاحظة: الفهرس المركّب [restaurantId, createdAt desc] القائم
 * يغطي استعلام restaurantId بدون مهاجرة جديدة.
 */
export async function GET() {
  const restaurant = await getOwnerRestaurant();
  if (!restaurant) {
    return NextResponse.json({ error: "غير مصرح — أعد تسجيل الدخول" }, { status: 401 });
  }

  try {
    // الأحدث أولًا حتى يبقى أحدث اسم لكل رقم عند إزالة التكرار
    // طلبات التوصيل فقط (لديها رقم هاتف) — طلبات الطاولة لا تصلح لتسويق WhatsApp
    const rows = await prisma.order.findMany({
      where: { restaurantId: restaurant.id, type: "delivery" },
      select: { customerName: true, phone: true },
      orderBy: { createdAt: "desc" },
    });

    // إزالة تكرار الأرقام: آخر اسم لكل رقم (لأن الترتيب newest-first)
    const unique = new Map<string, string>();
    for (const r of rows) {
      const phone = r.phone?.trim();
      if (!phone) continue;
      if (!unique.has(phone)) unique.set(phone, r.customerName);
    }

    /** تنظيف النص من أي شيء يكسر بنية CSV (فواصل، أسطر، اقتباسات) ثم تغليفه */
    const cell = (value: string) => {
      const cleaned = value.replace(/[\r\n,"]/g, " ").trim();
      return `"${cleaned}"`;
    };

    const lines = ['"Name","Phone"'];
    for (const [phone, name] of Array.from(unique)) {
      lines.push(`${cell(name)},${cell(phone)}`);
    }

    // BOM حتى يفتح إكسيل العربي الترميز بشكل صحيح
    const csv = `\uFEFF${lines.join("\r\n")}`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=customers_data.csv",
      },
    });
  } catch (e) {
    console.error("[export-customers] فشل التصدير:", e);
    return NextResponse.json(
      { error: "تعذّر تصدير بيانات العملاء — حاول مجددًا" },
      { status: 500 },
    );
  }
}