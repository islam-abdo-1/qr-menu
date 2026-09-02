import "server-only";
import { prisma } from "@/lib/prisma";
import {
  groqGenerate,
  extractGroqText,
  GroqQuotaExhaustedError,
  groqModelsCascade,
} from "@/lib/ai/groq";
import {
  MENU_ANALYSIS_SYSTEM,
  menuAnalysisUserPrompt,
} from "@/lib/ai/prompt-builder";
import { aiMenuSchema, markNeedsReview, sanitizeAiMenu, type AiMenuOutput } from "@/lib/ai/schemas";
import type { PlanLimits } from "./plan-limits";
import { imageSizeOf, extractTextFromImage } from "./image-service";

/** JSON schema منظم لمخرجات التحليل (Structured Output — بند 5) */
function responseSchema(): Record<string, unknown> {
  const itemProps = {
    name: { type: "STRING" },
    description: { type: "STRING", nullable: true },
    price: { type: "NUMBER", nullable: true },
    variants: {
      type: "ARRAY",
      nullable: true,
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          price: { type: "NUMBER", nullable: true },
        },
        required: ["name", "price"],
      },
    },
    image: {
      type: "OBJECT",
      nullable: true,
      properties: {
        detected: { type: "BOOLEAN" },
        confidence: { type: "NUMBER", nullable: true },
        region: {
          type: "OBJECT",
          nullable: true,
          properties: {
            x: { type: "NUMBER" },
            y: { type: "NUMBER" },
            w: { type: "NUMBER" },
            h: { type: "NUMBER" },
          },
          required: ["x", "y", "w", "h"],
        },
      },
      required: ["detected", "confidence", "region"],
    },
    sourcePage: { type: "INTEGER", nullable: true },
    confidence: { type: "NUMBER", nullable: true },
  };
  return {
    type: "OBJECT",
    properties: {
      restaurant: {
        type: "OBJECT",
        nullable: true,
        properties: {
          name: { type: "STRING", nullable: true },
          currency: { type: "STRING", nullable: true },
        },
      },
      categories: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            description: { type: "STRING", nullable: true },
            order: { type: "INTEGER" },
            categoryType: { type: "STRING", nullable: true },
            categoryConfidence: { type: "NUMBER", nullable: true },
            items: { type: "ARRAY", items: { type: "OBJECT", properties: itemProps, required: ["name"] } },
          },
          required: ["name", "order", "items"],
        },
      },
    },
    required: ["categories"],
  };
}

export type AnalyzeInput = {
  jobId: string;
  restaurantId: string;
  sourceType: "images";
  images: { mimeType: string; data: string; page: number }[];
  currencyHint?: string | null;
  limits: PlanLimits;
};

export type AnalyzeOutput = {
  menu: AiMenuOutput;
  provider: string;
  pageCount: number;
};

/**
 * تحليل المنيو الكامل: OCR + Groq (مجاني 100%).
 * 1. استخراج نص من الصور عبر OCR.space
 * 2. هيكلة النص المستخرج عبر Groq
 */
export async function analyzeMenu(
  input: AnalyzeInput,
): Promise<{ menu: AiMenuOutput; provider: string; pageCount: number }> {
  let pageCount = input.images.length || 1;

  const maxFiles = Number.parseInt(process.env.MAX_FILES_PER_JOB ?? "10", 10);
  const imgs = input.images.slice(0, maxFiles);
  pageCount = imgs.length;

  // ─── خطوة 1: OCR على كل صورة ───
  console.log("[analyzer] Starting OCR on", imgs.length, "image(s)...");
  const ocrTexts: string[] = [];
  
  for (const img of imgs) {
    const buffer = Buffer.from(img.data, "base64");
    const text = await extractTextFromImage(buffer, "eng");
    if (text) {
      ocrTexts.push(`[Page ${img.page}]\n${text}`);
      console.log(`[analyzer] OCR page ${img.page}: ${text.length} chars`);
    } else {
      console.warn(`[analyzer] OCR failed for page ${img.page}`);
      ocrTexts.push(`[Page ${img.page}]\n(OCR failed)`);
    }
  }

  const combinedOcrText = ocrTexts.join("\n\n---\n\n");
  console.log("[analyzer] Combined OCR text length:", combinedOcrText.length);

  if (!combinedOcrText.trim() || combinedOcrText === "(OCR failed)") {
    throw new Error("OCR failed to extract text from all images");
  }

  // ─── خطوة 2: Groq لهيكلة النص المستخرج ───
  const userPrompt = `استخرج من نص OCR التالي قائمة منيو منظمة:\n\n${combinedOcrText}\n\n${menuAnalysisUserPrompt(input.currencyHint ?? undefined)}`;

  // ─── المحاولة: Groq بشلال (مفتاح × موديل) ───
  try {
    const result = await groqGenerate({
      parts: [
        { text: MENU_ANALYSIS_SYSTEM },
        { text: userPrompt },
      ],
      responseSchema: responseSchema(),
      temperature: 0.1,
      modelsCascade: groqModelsCascade(),
      requestType: "menu_analysis",
      restaurantId: input.restaurantId,
      jobId: input.jobId,
    });

    const text = extractGroqText(result.data);
    console.log("[analyzer] Groq raw response (first 500 chars):", text.substring(0, 500));
    const parsed = safeParseMenu(text);
    if (parsed) {
      return {
        menu: markNeedsReview(
          parsed,
          Number.parseFloat(process.env.IMAGE_MATCH_CONFIDENCE_THRESHOLD ?? "0.85"),
        ),
        provider: `groq:${result.slot.model}`,
        pageCount,
      };
    }
    console.error("[analyzer] Groq رد غير صالح كـ JSON");
  } catch (e) {
    if (!(e instanceof GroqQuotaExhaustedError)) throw e;
  }

  throw new Error("groq: all models failed or invalid response");
}

/** تحليل آمن: استخراج JSON من نص (قد يلتف بـ ```json) + تطبيع شامل قبل Zod */
function safeParseMenu(text: string): AiMenuOutput | null {
  try {
    console.log("[safeParseMenu] Input text (first 500 chars):", text.substring(0, 500));
    const cleaned = text
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim();
    console.log("[safeParseMenu] Cleaned text (first 500 chars):", cleaned.substring(0, 500));
    const raw = JSON.parse(cleaned) as unknown;
    // التطبيع أولاً: ثقة 0-100→0-1 · أنواع أقسام غير معروفة→null · قصّ نصوص · أسعار آمنة
    const sanitized = sanitizeAiMenu(raw);
    const result = aiMenuSchema.safeParse(sanitized);
    if (!result.success) {
      // تسجيل كامل — أول 8 مشاكل بالتفصيل + عينة من الرد الخام
      console.error(
        "[analyzer] Zod validation failed:",
        JSON.stringify(
          result.error.issues.slice(0, 8).map((i) => ({
            path: i.path.join("."),
            code: i.code,
            message: i.message,
          })),
          null,
          1,
        ),
      );
      console.error(
        "[analyzer] raw sample:",
        cleaned.slice(0, 500),
      );
      return null;
    }
    return result.data;
  } catch (e) {
    console.error("[analyzer] JSON parse failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** حفظ نتيجة التحليل كأصناف قابلة للمراجعة */
export async function saveAnalysis(
  jobId: string,
  restaurantId: string,
  menu: AiMenuOutput,
  provider: string,
  pageCount: number,
): Promise<{ categoryCount: number; itemCount: number }> {
  const job = await prisma.aiMenuImportJob.findUnique({
    where: { id: jobId },
    select: { currency: true },
  });
  const defaultCurrency = job?.currency ?? menu.restaurant?.currency ?? "EGP";

  let itemCount = 0;
  let categoryCount = 0;

  for (const cat of menu.categories) {
    categoryCount++;
    for (let idx = 0; idx < cat.items.length; idx++) {
      const item = cat.items[idx];
      itemCount++;
      // اكتشاف أبعاد الصورة الأصلية إن وُجد region — للقص الدقيق لاحقاً
      const hasImage = Boolean(item.image?.detected);
      await prisma.aiMenuImportItem.create({
        data: {
          jobId,
          restaurantId,
          categoryName: cat.name,
          categoryType: cat.categoryType,
          categoryOrder: cat.order,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: defaultCurrency,
          sizeMode: (item.variants?.length ?? 0) > 0 ? "letters" : "letters",
          variants:
            item.variants && item.variants.length > 0
              ? (item.variants.map((v) => ({ name: v.name, price: v.price ?? 0 })) as unknown as [])
              : undefined,
          needsReview: item.needsReview ?? false,
          reviewReasons: item.reviewReasons
            ? (item.reviewReasons as unknown as [])
            : undefined,
          priceConfidence:
            item.price !== null ? (item.confidence ?? null) : null,
          categoryConfidence: cat.categoryConfidence ?? null,
          imageDetected: hasImage,
          imageSource: hasImage ? "MENU_ORIGINAL" : "NONE",
          imageConfidence: item.image?.confidence ?? null,
          imagePage: item.image?.detected ? (item.imagePage ?? item.sourcePage ?? null) : null,
          imageRegion:
            hasImage && item.image?.region
              ? (item.image.region as unknown as object)
              : undefined,
          sourcePage: item.sourcePage ?? null,
          sourceOrder: idx + 1,
          generationStatus: "PENDING",
        },
      });
    }
  }

  await prisma.aiMenuImportJob.update({
    where: { id: jobId },
    data: {
      status: "WAITING_REVIEW",
      detectedCategoryCount: categoryCount,
      detectedItemCount: itemCount,
      extractedImageCount: 0,
      providerUsed: provider,
      sourcePageCount: pageCount,
    },
  });

  return { categoryCount, itemCount };
}

/** أبعاد صورة من base64 — عبر Sharp (يُستخدم للتحقق من صفحات الصور) */
export async function imageSizeOfBase64(
  data: string,
): Promise<{ width: number; height: number } | null> {
  return imageSizeOf(Buffer.from(data, "base64"));
}