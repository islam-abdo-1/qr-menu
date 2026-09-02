import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * تخزين مؤقت للملفات المصدر (البند 10+49):
 * مسار منفصل تحت temp/ في نفس الـ bucket — يُحذف فوراً بعد:
 * COMPLETED / FAILED / انتهاء الصلاحية (تنظيف مجدول).
 * الملفات المصدر لا تُخزَّن نهائياً إطلاقاً.
 *
 * يستخدم Supabase Storage REST API مباشرة بدلاً من @supabase/supabase-js
 * لتجنب خطأ "Invalid Compact JWS" مع مفاتيح sb_secret_* (صيغة جديدة).
 */

const BUCKET = "menu-images";
const TEMP_PREFIX = "temp/ai-menu";

function storageBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const _key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return `${url.replace(/\/+$/, "")}/storage/v1`;
}

function serviceHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

export function tempPath(jobId: string, fileName: string): string {
  return `${TEMP_PREFIX}/${jobId}/${fileName}`;
}

/** رفع ملف مؤقت — يعيد المسار */
export async function putTempFile(
  jobId: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const path = tempPath(jobId, fileName);
  const base = storageBaseUrl();
  const ab = new Uint8Array(bytes).buffer as ArrayBuffer;
  const res = await fetch(
    `${base}/object/${BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: ab,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`temp upload: ${res.status} ${body}`);
  }
  return path;
}

/** تنزيل ملف مؤقت (للقص/المعالجة) */
export async function getTempFile(path: string): Promise<Buffer> {
  const base = storageBaseUrl();
  console.log("[getTempFile] Fetching:", `${base}/object/${BUCKET}/${encodeURIComponent(path)}`);
  const res = await fetch(
    `${base}/object/${BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "GET",
      headers: serviceHeaders(),
    },
  );
  console.log("[getTempFile] Response status:", res.status);
  if (!res.ok) {
    const body = await res.text();
    console.error("[getTempFile] Error:", res.status, body);
    throw new Error(`temp download: ${res.status} ${body}`);
  }
  const arr = await res.arrayBuffer();
  console.log("[getTempFile] Downloaded bytes:", arr.byteLength);
  return Buffer.from(arr);
}

/** حذف ملفات مؤقتة — best-effort (الفشل يُسجل ولا يُرمى) */
export async function deleteTempFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    const base = storageBaseUrl();
    const res = await fetch(
      `${base}/object/${BUCKET}/${paths.join(",")}`,
      {
        method: "DELETE",
        headers: serviceHeaders(),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error("[temp-cleanup] فشل حذف:", res.status, body);
    }
  } catch (e) {
    console.error("[temp-cleanup] فشل حذف ملفات مؤقتة:", paths.length, e);
  }
}

/** تنظيف ملفات طلب منتهٍ — يُستدعى من COMPLETED/FAILED/الجدولة */
export async function cleanupJob(jobId: string): Promise<void> {
  const job = await prisma.aiMenuImportJob.findUnique({
    where: { id: jobId },
    select: { tempFiles: true, geminiFiles: true },
  });
  if (!job) return;

  const tempPaths =
    (job.tempFiles as { path: string }[] | null)?.map((t) => t.path) ?? [];
  await deleteTempFiles(tempPaths);

  // تنظيف ملفات Gemini المتبقية (48h TTL احتياطي)
  try {
    const { geminiDeleteFile } = await import("@/lib/ai/gemini");
    const geminiNames =
      (job.geminiFiles as { name: string }[] | null)?.map((g) => g.name) ?? [];
    for (const name of geminiNames) {
      await geminiDeleteFile(name);
    }
  } catch (e) {
    console.error("[temp-cleanup] gemini cleanup failed:", e);
  }
}

/** تنظيف الطلبات المنتهية — يُستدعى من Cron اليومي (البند 10) */
export async function cleanupExpiredJobs(): Promise<number> {
  const expired = await prisma.aiMenuImportJob.findMany({
    where: {
      expiresAt: { lt: new Date() },
      status: { notIn: ["CLEANED"] },
    },
    select: { id: true },
    take: 50,
  });
  for (const job of expired) {
    try {
      await cleanupJob(job.id);
      await prisma.aiMenuImportJob.update({
        where: { id: job.id },
        data: { status: "CLEANED", tempFiles: undefined, geminiFiles: undefined },
      });
    } catch (e) {
      console.error(`[temp-cleanup] job ${job.id}:`, e);
    }
  }
  return expired.length;
}
