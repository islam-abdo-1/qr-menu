import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Groq Client — تحليل نصي سريع ومجاني (Llama-3.1).
 * واجهة مطابقة لـ geminiGenerate للتبديل السلس.
 * 6 مفاتيح × 2 موديل = 12 تركيبة في الـ cascade.
 */

const BASE = "https://api.groq.com/openai/v1";

export type GroqPart = { text: string };

export type GroqUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type GroqResult<T> = {
  data: T;
  usage: GroqUsage;
  slot: { key: string; model: string };
  durationMs: number;
};

type UsageLogInput = {
  restaurantId?: string | null;
  jobId?: string | null;
  requestType: "menu_analysis";
  model: string;
  keyFp: string;
  status: "ok" | "quota_exceeded" | "error" | "quota_exhausted";
  usage?: GroqUsage;
  durationMs: number;
  errorMessage?: string;
};

/** تسجيل كل استدعاء — أساس لوحة المراقبة */
async function logUsage(input: UsageLogInput): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        restaurantId: input.restaurantId ?? null,
        jobId: input.jobId ?? null,
        requestType: input.requestType,
        provider: "groq",
        model: input.model,
        keyFingerprint: input.keyFp,
        status: input.status,
        inputTokens: input.usage?.inputTokens ?? 0,
        outputTokens: input.usage?.outputTokens ?? 0,
        totalTokens: input.usage?.totalTokens ?? 0,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (e) {
    console.error("[groq] usage log failed (non-fatal):", e);
  }
}

function parseUsage(json: Record<string, unknown>): GroqUsage {
  const u = (json.usage ?? {}) as Record<string, number>;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    totalTokens: u.total_tokens ?? 0,
  };
}

function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  return status === 400 && /rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(body);
}

/** Groq API key pool — 6 مفاتيح × 2 موديل */
class GroqQuotaPool {
  private keys: string[] = [];
  private cooldowns = new Map<string, number>();
  private cursor = 0;

  constructor() {
    const raw = process.env.GROQ_API_KEYS ?? "";
    this.keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  }

  get configured(): boolean {
    return this.keys.length > 0;
  }

  get keyCount(): number {
    return this.keys.length;
  }

  get fingerprints(): string[] {
    return this.keys.map((k) => k.slice(-4));
  }

  /** يبني شلال التركيبات (موديل ← مفاتيحه بالتناوب) متجاهلاً الممنوعة */
  cascade(modelsCascade: string[]): { key: string; model: string }[] {
    const now = Date.now();
    const slots: { key: string; model: string }[] = [];
    const expiredKeys: string[] = [];
    this.cooldowns.forEach((until, k) => {
      if (until <= now) expiredKeys.push(k);
    });
    expiredKeys.forEach((k) => this.cooldowns.delete(k));

    for (const model of modelsCascade) {
      for (let i = 0; i < this.keys.length; i++) {
        const key = this.keys[(this.cursor + i) % this.keys.length];
        if (this.cooldowns.has(`${key}|${model}`)) continue;
        slots.push({ key, model });
      }
    }
    this.cursor = (this.cursor + 1) % Math.max(1, this.keys.length);
    return slots;
  }

  markExhausted(key: string, model: string): void {
    // Groq يعيد الحصة كل دقيقة — cooldown دقيقتان للسلامة
    this.cooldowns.set(`${key}|${model}`, Date.now() + 2 * 60 * 1000);
  }

  markTransientError(key: string, model: string): void {
    this.cooldowns.set(`${key}|${model}`, Date.now() + 60 * 1000);
  }

  status(modelsCascade: string[]): { fingerprint: string; activeCombos: number; totalCombos: number }[] {
    const now = Date.now();
    return this.keys.map((key) => {
      const fp = key.slice(-4);
      let active = 0;
      const total = modelsCascade.length;
      for (const model of modelsCascade) {
        const until = this.cooldowns.get(`${key}|${model}`);
        if (!until || until <= now) active++;
      }
      return { fingerprint: fp, activeCombos: active, totalCombos: total };
    });
  }
}

const globalForGroqPool = globalThis as unknown as { groqQuotaPool?: GroqQuotaPool };
export const groqQuotaPool: GroqQuotaPool =
  globalForGroqPool.groqQuotaPool ?? new GroqQuotaPool();
if (process.env.NODE_ENV !== "production") {
  globalForGroqPool.groqQuotaPool = groqQuotaPool;
}

/** موديلات Groq للتحليل — الأسرع والأكثر دقة أولاً */
export function groqModelsCascade(): string[] {
  return ["qwen/qwen3.8-27b", "groq/compound-mini", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"];
}

export class GroqQuotaExhaustedError extends Error {
  constructor() {
    super("Groq quota exhausted for today across all configured keys/models");
  }
}

/**
 * استدعاء Groq Chat Completions مع شلال (مفتاح × موديل) + تسجيل الاستخدام.
 * واجهة مطابقة لـ gemniGenerate للتبديل السلس.
 */
export async function groqGenerate(opts: {
  parts: { text: string }[];
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  modelsCascade: string[];
  requestType: "menu_analysis";
  restaurantId?: string | null;
  jobId?: string | null;
}): Promise<{
  data: Record<string, unknown>;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  slot: { key: string; model: string };
  durationMs: number;
}> {
  if (!groqQuotaPool.configured) {
    throw new GroqQuotaExhaustedError();
  }
  const slots = groqQuotaPool.cascade(opts.modelsCascade);
  if (slots.length === 0) throw new GroqQuotaExhaustedError();

  let lastBody = "";

  for (const slot of slots) {
    const started = Date.now();
    const fp = slot.key.slice(-4);
    try {
      // بناء الرسائل: system + user
      const messages: { role: string; content: string }[] = [];
      if (opts.parts[0]?.text) {
        messages.push({ role: "system", content: opts.parts[0].text });
      }
      if (opts.parts[1]?.text) {
        messages.push({ role: "user", content: opts.parts[1].text });
      }

      const body: Record<string, unknown> = {
        model: slot.model,
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: 2000,
        // Structured output — Groq يدعم json_object لكن بدون schema
        response_format: { type: "json_object" },
      };

      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${slot.key}`,
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(90_000),
      });

      console.log(`[groq] ${slot.model} (${fp}) status:`, res.status);
      const raw = await res.text();
      console.log(`[groq] ${slot.model} raw (first 300):`, raw.slice(0, 300));

      if (!res.ok) {
        lastBody = raw.slice(0, 300);
        if (isQuotaError(res.status, raw)) {
          groqQuotaPool.markExhausted(slot.key, slot.model);
          await logUsage({
            requestType: opts.requestType,
            model: slot.model,
            keyFp: fp,
            status: "quota_exceeded",
            durationMs: Date.now() - started,
            restaurantId: opts.restaurantId,
            jobId: opts.jobId,
            errorMessage: raw.slice(0, 200),
          });
          console.warn(`[groq] Quota exceeded for ${slot.model} (${fp}):`, raw.slice(0, 200));
          continue;
        }
        // خطأ عابر — cooldown دقيقة
        groqQuotaPool.markTransientError(slot.key, slot.model);
        await logUsage({
          requestType: opts.requestType,
          model: slot.model,
          keyFp: fp,
          status: "error",
          durationMs: Date.now() - started,
          restaurantId: opts.restaurantId,
          jobId: opts.jobId,
          errorMessage: `${res.status}: ${raw.slice(0, 200)}`,
        });
        continue;
      }

      const json = JSON.parse(raw) as Record<string, unknown>;
      const usage = parseUsage(json);
      await logUsage({
        requestType: opts.requestType,
        model: slot.model,
        keyFp: fp,
        status: "ok",
        usage,
        durationMs: Date.now() - started,
        restaurantId: opts.restaurantId,
        jobId: opts.jobId,
      });
      return { data: json, usage, slot, durationMs: Date.now() - started };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      groqQuotaPool.markTransientError(slot.key, slot.model);
      await logUsage({
        requestType: opts.requestType,
        model: slot.model,
        keyFp: fp,
        status: "error",
        durationMs: Date.now() - started,
        restaurantId: opts.restaurantId,
        jobId: opts.jobId,
        errorMessage: msg,
      });
      lastBody = msg;
    }
  }

  await logUsage({
    requestType: opts.requestType,
    model: "cascade",
    keyFp: "all",
    status: "quota_exhausted",
    durationMs: 0,
    restaurantId: opts.restaurantId,
    jobId: opts.jobId,
    errorMessage: lastBody,
  });
  throw new GroqQuotaExhaustedError();
}

/** استخراج النص من رد Groq */
export function extractGroqText(json: Record<string, unknown>): string {
  const choices = json.choices as
    | { message?: { content?: string } }[]
    | undefined;
  return choices?.[0]?.message?.content ?? "";
}