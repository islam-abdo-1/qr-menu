"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { orderSchema, staffLoginSchema } from "@/lib/validations";
import { fromZod, fail, ok, type ActionResult } from "@/lib/actions/helpers";
import { getOwnerRestaurant } from "@/lib/data";
import { getStaffSession, setStaffSession, clearStaffSession } from "@/lib/staff-session";

export type OrderStatus = "new" | "preparing" | "done";

const ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "done"];

const ORDER_TAG = "orders";

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
  total: number;
  createdAt: Date;
  completedAt: Date | null;
  items: { id: string; name: string; price: number; qty: number }[];
};

async function loadOrders(restaurantId: string): Promise<OrderView[]> {
  const orders = await prisma.order.findMany({
    where: { restaurantId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { items: { select: { id: true, name: true, price: true, qty: true } } },
  });
  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    type: o.type as "dine-in" | "delivery",
    customerName: o.customerName,
    tableNo: o.tableNo,
    phone: o.phone,
    address: o.address,
    notes: o.notes,
    status: o.status as OrderStatus,
    total: o.total,
    createdAt: o.createdAt,
    completedAt: o.completedAt,
    items: o.items,
  }));
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
  items: { itemId: string; qty: number }[];
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
    return fail("اكتب رقم الطاولة");
  }
  if (parsed.data.type === "delivery" && !parsed.data.phone?.trim()) {
    return fail("اكتب رقم الهاتف للتوصيل");
  }

  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: parsed.data.restaurantSlug },
    });
    if (!restaurant) return fail("المطعم غير موجود");

    // الأسعار من قاعدة البيانات فقط — لا نثق بسعر الواجهة
    const itemIds = parsed.data.items.map((i) => i.itemId);
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, restaurantId: restaurant.id, isAvailable: true },
    });
    if (dbItems.length !== itemIds.length) return fail("بعض العناصر غير متاحة حاليًا");
    const priceMap = new Map(dbItems.map((i) => [i.id, i.price]));

    const total = parsed.data.items.reduce(
      (sum, i) => sum + (priceMap.get(i.itemId) ?? 0) * i.qty,
      0,
    );
    if (total <= 0) return fail("السلة فارغة");

    const [{ nextval: number }] = await prisma.$queryRaw<{ nextval: number }[]>`
      SELECT nextval('order_number_seq')::int AS nextval
    `;

    const order = await prisma.order.create({
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
          create: parsed.data.items.map((i) => ({
            itemId: i.itemId,
            name: dbItems.find((d) => d.id === i.itemId)!.name,
            price: priceMap.get(i.itemId)!,
            qty: i.qty,
          })),
        },
      },
    });
    revalidateTag(ORDER_TAG);

    // عدّاد المبيعات اليومي (التقارير) — تحديث ذرّي، فشله لا يوقف الطلب
    try {
      const cairoDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      await prisma.$executeRaw`
        INSERT INTO "DayStat" ("id", "restaurantId", "date", "revenue", "orders", "dineIn", "delivery")
        VALUES (${crypto.randomUUID()}, ${restaurant.id}, ${cairoDate}::date, ${total}, 1,
          ${parsed.data.type === "dine-in" ? 1 : 0}, ${parsed.data.type === "delivery" ? 1 : 0})
        ON CONFLICT ("restaurantId", "date") DO UPDATE SET
          "revenue" = "DayStat"."revenue" + EXCLUDED."revenue",
          "orders"  = "DayStat"."orders"  + EXCLUDED."orders",
          "dineIn"  = "DayStat"."dineIn"  + EXCLUDED."dineIn",
          "delivery"= "DayStat"."delivery" + EXCLUDED."delivery"
      `;
    } catch (e) {
      console.error("[orders] daystat failed:", e);
    }

    return ok({ number: order.number, total: order.total });
  } catch (e) {
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

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.restaurantId !== restaurant.id) return fail("الطلب غير موجود");

    await prisma.order.update({
      where: { id: orderId },
      data: { status, completedAt: status === "done" ? new Date() : null },
    });
    revalidateTag(ORDER_TAG);
    return ok(null);
  } catch (e) {
    console.error("[orders] status failed:", e);
    return fail("حدث خطأ أثناء تحديث الطلب");
  }
}

/* ───────────────────── الموظفون (كود سري) ───────────────────── */

/** قائمة المطاعم الظاهرة لشاشة الموظفين (الاسم + slug) — معلومات عامة */
export async function getStaffRestaurantsAction(): Promise<
  ActionResult<{ id: string; name: string; slug: string }[]>
> {
  try {
    const restaurants = await prisma.restaurant.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true },
    });
    return ok(restaurants);
  } catch (e) {
    console.error("[staff] restaurants failed:", e);
    return fail("تعذّر تحميل المطاعم");
  }
}

export async function staffLoginAction(
  slug: string,
  pin: string,
): Promise<ActionResult<{ restaurantName: string; slug: string }>> {
  const parsed = staffLoginSchema.safeParse({ slug, pin });
  if (!parsed.success) {
    const { error } = fromZod(parsed.error);
    return fail(error);
  }
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: parsed.data.slug },
    });
    if (!restaurant || !restaurant.staffPin) return fail("المطعم غير موجود أو الكود غير مفعّل");

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
    await setStaffSession(restaurant.slug);
    return ok({ restaurantName: restaurant.name, slug: restaurant.slug });
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
  ActionResult<{ restaurantName: string; orders: OrderView[] }>
> {
  try {
    const slug = await getStaffSession();
    if (!slug) return fail("غير مصرح — أعد الدخول بالكود السري");
    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) return fail("المطعم غير موجود");
    return ok({ restaurantName: restaurant.name, orders: await loadOrders(restaurant.id) });
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
    const slug = await getStaffSession();
    if (!slug) return fail("غير مصرح — أعد الدخول بالكود السري");
    const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
    if (!restaurant) return fail("المطعم غير موجود");

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.restaurantId !== restaurant.id) return fail("الطلب غير موجود");

    await prisma.order.update({
      where: { id: orderId },
      data: { status, completedAt: status === "done" ? new Date() : null },
    });
    revalidateTag(ORDER_TAG);
    return ok(null);
  } catch (e) {
    console.error("[staff] status failed:", e);
    return fail("حدث خطأ أثناء تحديث الطلب");
  }
}
