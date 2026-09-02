import { describe, expect, it } from "vitest";
import {
  ACCOUNT_MAX_FAILED,
  INVALID_CREDENTIALS_MESSAGE,
  IP_MAX_FAILED,
  LOCKED_MESSAGE,
  isCountableFailure,
  loginLockDecision,
  uniformLoginError,
} from "@/lib/auth-lock";

describe("SEC-001: قرار القفل (حساب + IP) — بلا قفل دائم", () => {
  it("يسمح دون حاجز عند محاولات قليلة", () => {
    expect(loginLockDecision(0, 0)).toEqual({ locked: false, message: null });
    expect(loginLockDecision(4, 0)).toEqual({ locked: false, message: null });
    expect(loginLockDecision(0, IP_MAX_FAILED - 1)).toEqual({ locked: false, message: null });
  });
  it("يقفل الحساب عند 5 فاشلة خلال النافذة", () => {
    const d = loginLockDecision(ACCOUNT_MAX_FAILED, 0);
    expect(d.locked).toBe(true);
    expect(d.message).toBe(LOCKED_MESSAGE);
  });
  it("يقفل IP عند 20 فاشلة (رش على عدة حسابات)", () => {
    const d = loginLockDecision(0, IP_MAX_FAILED);
    expect(d.locked).toBe(true);
    expect(d.message).toBe(LOCKED_MESSAGE);
  });
  it("رسالة القفل واحدة للحساب والجهاز — لا نفصح أي معلومة", () => {
    const acc = loginLockDecision(ACCOUNT_MAX_FAILED, 0);
    const ip = loginLockDecision(0, IP_MAX_FAILED);
    expect(acc.message).toBe(ip.message);
  });
  it("البيانات الفاسدة (تعبئة زائدة) تُقفل مغلقًا لا تفتح الباب", () => {
    expect(loginLockDecision(-1, 0).locked).toBe(true);
    expect(loginLockDecision(Number.NaN, 0).locked).toBe(true);
    expect(loginLockDecision(1e9, 0).locked).toBe(true);
  });
  it("المحاولات القديمة خارج النافذة لا تُحتسب — القفل زمني متجدد لا دائم", () => {
    // عدّاد DB نفسه يفلتر بالنافذة؛ القرار هنا عددي فقط — بعد انزلاق النافذة ينخفض العدّاد
    // على مستوى القاعدة (اختبار نافذة زمنية حقيقي = خارج الوحدات النقية)
    expect(loginLockDecision(ACCOUNT_MAX_FAILED - 1, 0).locked).toBe(false);
  });
});

describe("SEC-001: عدم التمييز (No user enumeration)", () => {
  it("كلمة خاطئة / حساب غير موجود / بريد غير مؤكد → نفس الرسالة تمامًا", () => {
    const wrongPassword = uniformLoginError("Invalid login credentials");
    const noUser = uniformLoginError("User not found");
    const unconfirmed = uniformLoginError("Email not confirmed");
    const generic = uniformLoginError("some other auth failure");
    expect(wrongPassword).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(noUser).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(unconfirmed).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(generic).toBe(INVALID_CREDENTIALS_MESSAGE);
    // لا مجال لاكتشاف وجود الحساب من النص: كل الأنواع متطابقة تمامًا
    expect(new Set([wrongPassword, noUser, unconfirmed, generic]).size).toBe(1);
  });
  it("رسالة معدل الطلبات العالمية مختلفة لكنها لا تكشف حسابات", () => {
    const rate = uniformLoginError("Email rate limit exceeded");
    expect(rate).not.toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(rate).toContain("طلبات كثيرة");
  });
  it("الرفض بسبب المعدل لا يُحتسب في عدّاد القفل", () => {
    expect(isCountableFailure("Email rate limit exceeded")).toBe(false);
    expect(isCountableFailure("Too many requests")).toBe(false);
  });
  it("فشل الاعتمادات الحقيقي يُحتسب (يغذي القفل)", () => {
    expect(isCountableFailure("Invalid login credentials")).toBe(true);
    expect(isCountableFailure("Email not confirmed")).toBe(true);
    expect(isCountableFailure("User not found")).toBe(true);
  });
});