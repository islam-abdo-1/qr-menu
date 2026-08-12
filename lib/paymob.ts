import "server-only";
import { createHmac, randomUUID } from "crypto";

/** بوابة Paymob — تُفعَّل تلقائيًا بمجرد وضع المفاتيح في البيئة (المرحلة ب/ج) */
const API = "https://accept.paymob.com/api";

export function isPaymobConfigured(): boolean {
  const key = process.env.PAYMOB_API_KEY;
  return Boolean(key && !/your-|dummy/i.test(key));
}

async function paymobJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.id === undefined || data.id === null) {
    throw new Error(`paymob ${path} فشل: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

export type PaymobCheckout = {
  orderId: string;
  iframeUrl: string;
};

/**
 * إنشاء جلسة دفع (فوري/فودافون عبر iframe الموحّد):
 * auth token → أمر دفع → مفتاح دفع → رابط iframe
 */
export async function createPaymobCheckout(
  plan: "monthly" | "annual",
  customerName: string,
  email: string,
): Promise<PaymobCheckout> {
  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  if (!apiKey || !integrationId || !iframeId) {
    throw new Error("مفاتيح Paymob غير مكتملة — PAYMOB_API_KEY / PAYMOB_INTEGRATION_ID / PAYMOB_IFRAME_ID");
  }

  const amountCents = plan === "annual" ? 2300 * 100 : 250 * 100;

  const auth = await paymobJson("/auth/tokens", { api_key: apiKey });
  const token = String(auth.token);

  const order = await paymobJson("/ecommerce/orders", {
    auth_token: token,
    delivery_needed: false,
    amount_cents: amountCents,
    currency: "EGP",
    items: [],
  });
  const orderId = String(order.id);

  const paymentKey = await paymobJson("/acceptance/payment_keys", {
    auth_token: token,
    amount_cents: amountCents,
    currency: "EGP",
    order_id: orderId,
    integration_id: Number(integrationId),
    billing_data: {
      apartment: "NA",
      email,
      floor: "NA",
      first_name: customerName.slice(0, 50) || "مطعم",
      street: "NA",
      building: "NA",
      phone_number: "01000000000",
      shipping_method: "NA",
      postal_code: "NA",
      city: "NA",
      country: "EG",
      last_name: ".",
      state: "NA",
    },
  });
  const paymentToken = String(paymentKey.token);

  return {
    orderId,
    iframeUrl: `${API}/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`,
  };
}

/** حقول رد Paymob المرتبة أبجديًا — أساس التحقق من التوقيع */
const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occurred",
  "has_ssl",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order",
  "owner",
  "pending",
  "source_data_pan",
  "source_data_sub_type",
  "source_data_type",
  "success",
  "token",
  "txn_response_codes",
];

/** تحقق HMAC-SHA512 من رد Paymob — يمنع التزوير ويضمن أن الرد من البوابة فعلًا */
export function verifyPaymobSignature(
  obj: Record<string, unknown>,
  hmac: string | undefined,
): boolean {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret || !hmac) return false;
  const text = HMAC_FIELDS.map((f) => String(obj[f] ?? "")).join("|");
  const digest = createHmac("sha512", secret).update(text).digest("hex");
  return digest === hmac;
}

/** مرجع دفعة داخل المنصة — مرادف paymobRef */
export function newPaymentRef(): string {
  return `pm-${randomUUID()}`;
}