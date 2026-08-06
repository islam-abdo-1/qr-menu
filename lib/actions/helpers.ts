import { z } from "zod";

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** تحويل أخطاء zod إلى تنسيق موحّد للواجهة */
export function fromZod(error: z.ZodError): { error: string; fieldErrors: FieldErrors } {
  const flattened = (error as z.ZodError).flatten().fieldErrors as FieldErrors;
  const first = flattened[Object.keys(flattened)[0]]?.[0];
  return {
    error: first ?? "البيانات المدخلة غير صحيحة",
    fieldErrors: flattened,
  };
}