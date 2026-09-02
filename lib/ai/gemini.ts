import "server-only";

/** Gemini معطل — نستخدم Groq بدلاً منه. هذه الدوال للتوافق مع كود التنظيف القديم فقط. */

export class QuotaExhaustedError extends Error {
  constructor() { super("Gemini quota exhausted — disabled"); }
}

export type QuotaSlot = { key: string; model: string };
type _GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

type _GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type _GeminiResult<T> = {
  data: T;
  usage: _GeminiUsage;
  slot: QuotaSlot;
  durationMs: number;
};

const _BASE = "https://generativelanguage.googleapis.com/v1beta";
const _UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";

/** استدعاء معطل — يرمي خطأ */
export async function geminiGenerate(_opts: {
  parts: _GeminiPart[];
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  temperature?: number;
  modelsCascade: string[];
  requestType: "menu_analysis" | "image_gen";
  restaurantId?: string | null;
  jobId?: string | null;
  wantImage?: boolean;
}): Promise<_GeminiResult<Record<string, unknown>>> {
  throw new Error("Gemini disabled — use Groq instead");
}

/** رفع ملف — معطل */
export async function geminiUploadFile(
  _bytes: Buffer,
  _mimeType: string,
  _displayName: string,
): Promise<{ uri: string; mimeType: string; name: string }> {
  throw new Error("Gemini disabled — use Groq instead");
}

/** حذف ملف — معطل (best-effort) */
export async function geminiDeleteFile(_name: string): Promise<void> {
  // لا نفعل شيئاً — الـ 48h TTL سيحذفه تلقائياً
  return;
}

/** استخراج النص — معطل */
export function extractText(_json: Record<string, unknown>): string {
  return "";
}

/** استخراج الصورة — معطل */
export function extractImage(_json: Record<string, unknown>): {
  mimeType: string;
  data: string;
} | null {
  return null;
}