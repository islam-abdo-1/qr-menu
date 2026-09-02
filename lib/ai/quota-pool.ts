import "server-only";

/**
 * مجمع الحصص — معطل للخدمات القديمة (Gemini/OpenRouter).
 * تم استبداله بـ Groq Quota Pool في lib/ai/groq.ts
 */

export type QuotaSlot = { key: string; model: string };

/** بصمة آمنة للمفتاح — آخر 4 حروف فقط (للسجلات) */
export function keyFingerprint(key: string): string {
  return key.slice(-4);
}

/** شلال موديلات التحليل — يستخدم Groq الآن */
export function menuModelsCascade(): string[] {
  // يستخدم Groq عبر lib/ai/groq.ts
  return ["qwen/qwen3.8-27b", "groq/compound-mini", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];
}

/** شلال موديلات توليد الصور — معطل (نستخدم Pollinations) */
export function imageModelsCascade(): string[] {
  return [];
}

/** نفدت كل التركيبات — رسالة ودية للمستخدم */
export class QuotaExhaustedError extends Error {
  constructor() {
    super("AI quota exhausted for today across all configured keys/models");
  }
}

/** شلال موديلات OpenRouter — معطل */
export function openRouterModelsCascade(): string[] {
  return [];
}