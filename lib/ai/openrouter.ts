import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * OpenRouter — مزود احتياطي اختياري (البند 6).
 * يُستخدم لتحليل المنيو النصي عند نفاد كل حصص Gemini.
 * يدعم شلال مفاتيح (OPENROUTER_API_KEYS) + شلال نماذج مجانية.
 * موديلات :free = تكلفة صفر (متطلب المستخدم: كل شيء مجاني).
 */

const BASE = "https://openrouter.ai/api/v1";

export type OpenRouterResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number;
};

// شلال النماذج المجانية — تُجرب بالترتيب
const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "qwen/qwen2-vl-7b-instruct:free",
  "meta-llama/llama-3.2-11b-vision:free",
  "google/gemma-3-27b-it:free",
  "deepseek/deepseek-r1:free",
  "mistralai/mistral-7b-instruct:free",
];

function getApiKeys(): string[] {
  const keys = process.env.OPENROUTER_API_KEYS;
  if (keys) return keys.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env.OPENROUTER_API_KEY;
  return single ? [single] : [];
}

export function isOpenRouterConfigured(): boolean {
  return getApiKeys().length > 0;
}

/** تحليل نصي عبر OpenRouter — fallback لتحليل المنيو فقط (لا توليد صور) */
export async function openRouterGenerate(opts: {
  system: string;
  user: string;
  imageDataUrls?: { mimeType: string; data: string }[];
  restaurantId?: string | null;
  jobId?: string | null;
}): Promise<OpenRouterResult> {
  const apiKeys = getApiKeys();
  if (apiKeys.length === 0) {
    throw new Error("OpenRouter غير مهيأ — OPENROUTER_API_KEYS مفقود");
  }

  const content: Record<string, unknown>[] = [];
  for (const img of opts.imageDataUrls ?? []) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    });
  }
  content.push({ type: "text", text: opts.user });

  let lastError: string | null = null;

  // شلال: مفتاح × موديل
  for (const apiKey of apiKeys) {
    for (const model of FREE_MODELS) {
      const started = Date.now();
      try {
        const res = await fetch(`${BASE}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://qr-menu.app",
            "X-Title": "QR Menu AI",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: opts.system },
              { role: "user", content },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(90_000),
        });

        const raw = await res.text();
        const durationMs = Date.now() - started;

        if (!res.ok) {
          lastError = `openrouter ${res.status}: ${raw.slice(0, 200)}`;
          // 401/403 = مفتاح غير صالح، جرب المفتاح التالي
          if (res.status === 401 || res.status === 403) {
            break;
          }
          // 429 = حصة منتهية، جرب المفتاح التالي
          if (res.status === 429) {
            continue;
          }
          // أخطاء أخرى = جرب النموذج التالي
          continue;
        }

        const json = JSON.parse(raw) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const text = json.choices?.[0]?.message?.content ?? "";
        const inputTokens = json.usage?.prompt_tokens ?? 0;
        const outputTokens = json.usage?.completion_tokens ?? 0;
        await logUsage(opts, model, "ok", durationMs, null, inputTokens, outputTokens, apiKey);

        return { text, inputTokens, outputTokens, model, durationMs };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastError = msg;
        await logUsage(opts, model, "error", Date.now() - started, msg, 0, 0, apiKey);
        // جرب النموذج التالي
        continue;
      }
    }
  }

  throw new Error(lastError || "OpenRouter: all keys and models exhausted");
}

async function logUsage(
  opts: { restaurantId?: string | null; jobId?: string | null },
  model: string,
  status: string,
  durationMs: number,
  errorMessage: string | null,
  inputTokens: number,
  outputTokens: number,
  apiKey: string,
): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        restaurantId: opts.restaurantId ?? null,
        jobId: opts.jobId ?? null,
        requestType: "menu_analysis",
        provider: "openrouter",
        model,
        keyFingerprint: apiKey.slice(0, 8),
        status,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        durationMs,
        errorMessage: errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (e) {
    console.error("[openrouter] usage log failed:", e);
  }
}