"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orderSchema, staffLoginSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { applyDiscount } from "@/lib/utils";
import { isValidPhone } from "@/lib/utils";
import { getStaffSession, setStaffSession, clearStaffSession } from "@/lib/staff-session";

export type OrderStatus = "new" | "preparing" | "done";

const ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "done"];

const ORDER_TAG = "orders";

const STATUS_RANK: Record<OrderStatus, number> = { new: 0, preparing: 1, done: 2 };

/** خطأ تحقق من بند طلب — يُعرض رسالته للزبون كفشل طلب طبيعي */
class OrderLineError extends Error {}

export type OrderView = {
  id: string;
  number: number;
  type: "dine-in" | "delivery";
  customerName: string;
  tableNo: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: OrderStatus;
  staffName: string | null;
  total: number;
  createdAt: Date;
  completedAt: Date | null;
  items: {
    id: string;
    name: string;
    price: number;
    qty: number;
    sizeCode: string | null;
    imageUrl: string | null;
  }[];
};

async function loadOrders(restaurantId: string): Promise<OrderView[]> {
  // استعلامان متوازيان خفيفان:
  //  - النشط (جديد/في التحضير): يُجلب كاملًا دائمًا — لا يختفي طلب شغال أبدًا
  //  - المكتمل: آخر 30 يومًا (مطابق للتنظيف التلقائي) بحد 500 —
  //    يكفي للتاريخ الكامل دون تضخم الاستجابة. الأقدم يُمسح تلقائيًا من القاعدة.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [active, done] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, status: { in: ["new", "preparing"] } },
      include: {
        items: { select: { id: true, name: true, price: true, qty: true, sizeCode: true, itemId: true } },
      },
    }),
    prisma.order.findMany({
      where: { restaurantId, status: "done", createdAt: { gte: since } },
      include: {
        items: { select: { id: true, name: true, price: true, qty: true, sizeCode: true, itemId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  const orders = [...active, ...done];

  // صور الأصناف من جدول المنيو الأصلي (بلا علاقة Prisma) — تُعرض في تفاصيل الطلب
  const itemIds = Array.from(
    new Set(
      orders
        .flatMap((o) => o.items.map((i) => i.itemId))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const imageMap = new Map<string, string | null>();
  if (itemIds.length > 0) {
    const imgs = await prisma.menuItem.findMany({
      where: { restaurantId, id: { in: itemIds } },
      select: { id: true, imageUrl: true },
    });
    imgs.forEach((m) => imageMap.set(m.id, m.imageUrl));
  }

  // ترتيب ثابت: الجديد أولًا ثم في التحضير ثم تم التسليم، والأحدث أولًا داخل كل حالة
  return orders
    .map((o) => ({
      id: o.id,
      number: o.number,
      type: o.type as "dine-in" | "delivery",
      customerName: o.customerName,
      tableNo: o.tableNo,
      phone: o.phone,
      address: o.address,
      notes: o.notes,
      status: o.status as OrderStatus,
      staffName: o.staffName,
      total: o.total,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      items: o.items.map((i) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        qty: i.qty,
        sizeCode: i.sizeCode,
        imageUrl: i.itemId ? (imageMap.get(i.itemId) ?? null) : null,
      })),
    }))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

/* ───────────────────── الزبون: إنشاء طلب ───────────────────── */

export type CreateOrderInput = {
  restaurantSlug: string;
  customerName: string;
  type: "dine-in" | "delivery";
  tableNo?: string;
  phone?: string;
  address?: string;
  notes?: string;
  items: { itemId: string; qty: number; sizeCode?: string | null }[];
};

export async function createOrderAction(
  input: CreateOrderInput,
): Promise<ActionResult<{ number: number; total: number }>> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const { error, fieldErrors } = fromZod(parsed.error);
    return fail(error, fieldErrors);
  }

  // التحقق الإجباري حسب نوع الطلب
  if (parsed.data.type === "dine-in" && !parsed.data.tableNo?.trim()) {
    return fail("اختر رقم الطاولة");
  }
  if (parsed.data.type === "delivery") {
    if (!parsed.data.phone?.trim()) {
      return fail("اكتب رقم الهاتف للتوصيل");
    }
    if (!isValidPhone(parsed.data.phone)) {
      return fail("رقم الهاتف غير صحيح — اكتب رقم الجوال 11 رقمًا (مثال: 01012345678)");
    }
  }

  try {
    // استعلامات متوازية (بلا تسلسل) — الأسعار من قاعدة البيانات فقط
    const itemIds = parsed.data.items.map((i) => i.itemId);
    const [restaurant, dbItems, tables, numberRow] = await Promise.all([
      prisma.restaurant.findUnique({ where: { slug: parsed.data.restaurantSlug } }),
      prisma.menuItem.findMany({
        where: { id: { in: itemIds }, restaurant: { slug: parsed.data.restaurantSlug }, isAvailable: true },
        select: {
          id: true,
          name: true,
          price: true,
          discountPercentage: true,
          sizes: { select: { sizeCode: true, price: true } },
        },
      }),
      prisma.table.findMany({
        where: { restaurant: { slug: parsed.data.restaurantSlug } },
        select: { number: true, reserved: true },
      }),
      prisma.$queryRaw<{ nextval: number }[]>`
        SELECT nextval('order_number_seq')::int AS nextval
      `,
    ]);
    if (!restaurant) return fail("المطعم غير موجود");

    // الطاولة يجب أن تكون مضافة من لوحة الإدارة وغير محجوزة
    if (parsed.data.type === "dine-in") {
      const tableNum = Number.parseInt(parsed.data.tableNo!, 10);
      const table = tables.find((t) => t.number === tableNum);
      if (!table) return fail("اختر طاولة من القائمة");
      if (table.reserved) return fail("هذه الطاولة محجوزة حاليًا");
    }

    if (dbItems.length !== itemIds.length) return fail("بعض العناصر غير متاحة حاليًا");
    const itemMap = new Map(dbItems.map((i) => [i.id, i]));
    const sizeMap = new Map(
      dbItems.flatMap((i) => i.sizes.map((s) => [`${i.id}::${s.sizeCode}`, s.price])),
    );

    // حساب السعر نهائيًا من القاعدة فقط: مقاس إن وُجد ثم الخصم إن وُجد
    // العميل لا يرسل أسعارًا أبدًا — أي تلاعب لا يتجاوز هذا الحساب.
    const lines = parsed.data.items.map((i) => {
      const item = itemMap.get(i.itemId)!;
      const sizeCode = i.sizeCode || null;
      const unitPrice = sizeCode
        ? (sizeMap.get(`${i.itemId}::${sizeCode}`) ?? NaN)
        : item.price;
      if (!Number.isFinite(unitPrice)) {
        throw new OrderLineError("مقاس غير صالح لعنصر في سلة المشتريات");
      }
      const finalPrice = applyDiscount(unitPrice, item.discountPercentage);
      return { item, sizeCode, unitPrice, finalPrice, qty: i.qty };
    });

    const total = lines.reduce((sum, l) => sum + l.finalPrice * l.qty, 0);
    if (total <= 0) return fail("السلة فارغة");

    const number = numberRow[0].nextval;

    // إنشاء الطلب + عدّاد المبيعات في معاملة واحدة (رحلة شبكة واحدة بدل اثنتين)
    await prisma.$transaction([
      prisma.order.create({
        data: {
          restaurantId: restaurant.id,
          number,
          type: parsed.data.type,
          customerName: parsed.data.customerName,
          tableNo: parsed.data.tableNo?.trim() || null,
          phone: parsed.data.phone?.trim() || null,
          address: parsed.data.address?.trim() || null,
          notes: parsed.data.notes?.trim() || null,
          total,
          items: {
            create: lines.map((l) => ({
              itemId: l.item.id,
              name: l.item.name,
              sizeCode: l.sizeCode,
              price: l.finalPrice,
              qty: l.qty,
            })),
          },
        },
      }),
      prisma.$executeRaw`
        INSERT INTO "DayStat" ("id", "restaurantId", "date", "revenue", "orders", "dineIn", "delivery")
        VALUES (${crypto.randomUUID()}, ${restaurant.id},
          ${new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Cairo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date())}::date,
          ${total}, 1,
          ${parsed.data.type === "dine-in" ? 1 : 0}, ${parsed.data.type === "delivery" ? 1 : 0})
        ON CONFLICT ("restaurantId", "date") DO UPDATE SET
          "revenue" = "DayStat"."revenue" + EXCLUDED."revenue",
          "orders"  = "DayStat"."orders"  + EXCLUDED."orders",
          "dineIn"  = "DayStat"."dineIn"  + EXCLUDED."dineIn",
          "delivery"= "DayStat"."delivery" + EXCLUDED."delivery"
      `,
    ]);

    // تنظيف تلقائي: الطلبات المكتملة الأقدم من 30 يومًا — يحافظ على حجم القاعدة
    // في حدود الـ 500MB المجانية (التقارير اليومية محفوظة في DayStat فلا تتأثر أبدًا)
    await prisma.order.deleteMany({
      where: {
        restaurantId: restaurant.id,
        status: "done",
        createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    revalidateTag(ORDER_TAG);

    return ok({ number, total });
  } catch (e) {
    if (e instanceof OrderLineError) return fail(e.message);
    console.error("[orders] create failed:", e);
    return fail("حدث خطأ أثناء إرسال الطلب — حاول مجددًا");
  }
}

/* ───────────────────── المالك (لوحة الإدارة) ───────────────────── */

export async function getOrdersAction(): Promise<ActionResult<OrderView[]>> {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");
    return ok(await loadOrders(restaurant.id));
  } catch (e) {
    console.error("[orders] admin list failed:", e);
    return fail("تعذّر تحميل الطلبات");
  }
}

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult<null>> {
  if (!ORDER_STATUSES.includes(status)) return fail("حالة غير صالحة");
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) return fail("غير مصرح — أعد تسجيل الدخول");

    // تحديث واحد بشرط الملكية — يتحقق من وجود الطلب وانتمائه للمطعم معًا
    const res = await prisma.order.updateMany({
      where: { id: orderId, restaurantId: restaurant.id },
      data: { status, completedAt: status === "done" ? new Date() : null },
    });
    if (res.count === 0) return fail("الطلب غير موجود");
    revalidateTag(ORDER_TAG);
    return ok(null);
  } catch (e) {
    console.error("[orders] status failed:", e);
    return fail("حدث خطأ أثناء تحديث الطلب");
  }
}

/* ───────────────────── الموظفون (اسم + الكود المشترك) ───────────────────── */

/**
 * دخول الموظفين بالاسم + الكود السري المشترك:
 * - مع slug (من رابط /staff/kafy): يتحقق من الاسم والكود لذلك المطعم تحديدًا.
 * - بدون slug (/staff): يبحث عن المطعم صاحب الكود — فهرس فريد يضمن تطابقًا واحدًا.
 */
export async function staffLoginAction(
  name: string,
  pin: string,
  slug?: string,
): Promise<
  ActionResult<{ restaurantName: string; slug: string; name: string }>
> {
  const parsed = staffLoginSchema.safeParse({ name, pin });
  if (!parsed.success) {
    const { error } = fromZod(parsed.error);
    return fail(error);
  }
  try {
    const restaurant = slug
      ? await prisma.restaurant.findUnique({ where: { slug } })
      : await prisma.restaurant.findFirst({ where: { staffPin: parsed.data.pin } });
    if (!restaurant || !restaurant.staffPin) return fail("المطعم غير موجود أو الكود غير مفعّل");

    // الاسم يجب أن يكون مسجّلًا ضمن موظفي هذا المطعم + إعدادات العرض الحية (الاسم مُحرَّر من اللوحة)
    const [staff, setting] = await Promise.all([
      prisma.staff.findFirst({
        where: {
          restaurantId: restaurant.id,
          name: { equals: parsed.data.name, mode: "insensitive" },
        },
        select: { id: true },
      }),
      prisma.setting.findUnique({ where: { restaurantId: restaurant.id } }),
    ]);
    if (!staff) return fail("هذا الاسم غير مسجّل في قائمة الموظفين");

    // قفل بعد 5 محاولات خاطئة — يمنع تخمين الكود السري
    const LOCKED_MSG = "محاولات كثيرة — انتظر ٥ دقائق ثم حاول";
    if (restaurant.pinLockedUntil && restaurant.pinLockedUntil.getTime() > Date.now()) {
      return fail(LOCKED_MSG);
    }

    if (restaurant.staffPin !== parsed.data.pin) {
      const attempts = restaurant.pinFailedAttempts + 1;
      if (attempts >= 5) {
        await prisma.restaurant.update({
          where: { id: restaurant.id },
          data: { pinFailedAttempts: 0, pinLockedUntil: new Date(Date.now() + 5 * 60 * 1000) },
        });
        return fail(LOCKED_MSG);
      }
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { pinFailedAttempts: attempts },
      });
      return fail("الكود السري غير صحيح");
    }

    // كود صحيح — أعد تعيين العدّاد
    if (restaurant.pinFailedAttempts > 0 || restaurant.pinLockedUntil) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { pinFailedAttempts: 0, pinLockedUntil: null },
      });
    }
    await setStaffSession({ slug: restaurant.slug, name: parsed.data.name });
    return ok({
      restaurantName: setting?.restaurantName || restaurant.name,
      slug: restaurant.slug,
      name: parsed.data.name,
    });
  } catch (e) {
    console.error("[staff] login failed:", e);
    return fail("حدث خطأ أثناء الدخول");
  }
}

export async function staffLogoutAction(): Promise<ActionResult<null>> {
  await clearStaffSession();
  return ok(null);
}

export async function getStaffOrdersAction(): Promise<
  ActionResult<{
    restaurantName: string;
    staffName: string;
    orders: OrderView[];
    brand: { logoUrl: string | null; currency: string };
  }>
> {
  try {
    const session = await getStaffSession();
    if (!session) return fail("غير مصرح — أعد الدخول بالاسم والكود السري");
    const restaurant = await prisma.restaurant.findUnique({ where: { slug: session.slug } });
    if (!restaurant) return fail("المطعم غير موجود");
    // الإعدادات الحية: الاسم والشعار والعملة كما في لوحة الإدارة — لا نسخة التسجيل الميتة
    const setting = await prisma.setting.findUnique({
      where: { restaurantId: restaurant.id },
    });
    return ok({
      restaurantName: setting?.restaurantName || restaurant.name,
      staffName: session.name,
      orders: await loadOrders(restaurant.id),
      brand: {
        logoUrl: setting?.logoUrl || null,
        currency: setting?.currency || "EGP",
      },
    });
  } catch (e) {
    console.error("[staff] orders failed:", e);
    return fail("تعذّر تحميل الطلبات");
  }
}

export async function staffUpdateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult<null>> {
  if (!ORDER_STATUSES.includes(status)) return fail("حالة غير صالحة");
  try {
    const session = await getStaffSession();
    if (!session) return fail("غير مصرح — أعد الدخول بالاسم والكود السري");

    // تحديث واحد بشرط الملكية + تسجيل اسم الموظف الذي تعامل مع الطلب
    const res = await prisma.order.updateMany({
      where: { id: orderId, restaurant: { slug: session.slug } },
      data: { status, completedAt: status === "done" ? new Date() : null, staffName: session.name },
    });
    if (res.count === 0) return fail("الطلب غير موجود");
    revalidateTag(ORDER_TAG);
    return ok(null);
  } catch (e) {
    console.error("[staff] status failed:", e);
    return fail("حدث خطأ أثناء تحديث الطلب");
  }
}
