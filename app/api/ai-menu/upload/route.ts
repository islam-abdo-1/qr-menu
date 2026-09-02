import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOwnerRestaurant } from "@/lib/data";
import { rateLimitIp } from "@/lib/rate-limit";
import { putTempFile } from "@/lib/ai-menu/temp-storage";
import { checkImportQuota } from "@/lib/ai-menu/plan-limits";
import { imageSizeOf } from "@/lib/ai-menu/image-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai-menu/upload â€” Ø±ÙØ¹ Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ù†ÙŠÙˆ (ØµÙˆØ± Ø£Ùˆ PDF) Ø¥Ù„Ù‰ ØªØ®Ø²ÙŠÙ† Ù…Ø¤Ù‚Øª.
 * Ø­Ù…Ø§ÙŠØ©: Ø¬Ù„Ø³Ø© Ù…Ø§Ù„Ùƒ + Ù…Ù„ÙƒÙŠØ© Ù…Ø·Ø¹Ù… + rate limit + ÙØ­Øµ Ù†ÙˆØ¹/Ø­Ø¬Ù… + Ø­ØµØ© Ø§Ù„Ø¨Ø§Ù‚Ø©.
 * Ù„Ø§ ÙŠÙ„Ù…Ø³ Ø§Ù„Ù…Ù†ÙŠÙˆ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ø¥Ø·Ù„Ø§Ù‚Ø§Ù‹ â€” ØªØ®Ø²ÙŠÙ† Ù…Ø¤Ù‚Øª ÙÙ‚Ø· (Ø§Ù„Ø¨Ù†Ø¯ 10).
 */
export async function POST(req: Request) {
  try {
    const restaurant = await getOwnerRestaurant();
    if (!restaurant) {
      return NextResponse.json({ ok: false, error: "ØºÙŠØ± Ù…ØµØ±Ø­" }, { status: 401 });
    }

    const hdrs = headers();
    const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    const limited = await rateLimitIp("ai-menu-upload", ip, 6, 60 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Ù…Ø­Ø§ÙˆÙ„Ø§Øª ÙƒØ«ÙŠØ±Ø© â€” Ø§Ù†ØªØ¸Ø± Ø³Ø§Ø¹Ø©" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      );
    }

    // Ø­ØµØ© Ø§Ù„Ø¨Ø§Ù‚Ø©
    const quota = await checkImportQuota(restaurant.id, restaurant);
    if (!quota.ok) {
      return NextResponse.json({ ok: false, error: quota.reason }, { status: 403 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: "Ù„Ù… ÙŠØªÙ… Ø§Ø®ØªÙŠØ§Ø± Ù…Ù„ÙØ§Øª" }, { status: 400 });
    }

    const maxFiles = Number.parseInt(process.env.MAX_FILES_PER_JOB ?? "10", 10);
    if (files.length > maxFiles) {
      return NextResponse.json(
        { ok: false, error: `Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ ${maxFiles} Ù…Ù„ÙØ§Øª` },
        { status: 400 },
      );
    }

    const maxPdfMB = Number.parseInt(process.env.MAX_PDF_SIZE_MB ?? "20", 10);
    const maxPages = Number.parseInt(process.env.MAX_PAGES ?? "30", 10);

    // ÙØ­Øµ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹ ÙˆØ§Ù„Ø£Ø­Ø¬Ø§Ù…
    const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
    const pdfFiles = files.filter((f) => f.type === "application/pdf");
    const imageFiles = files.filter((f) => ALLOWED_IMAGE.includes(f.type));
    if (pdfFiles.length + imageFiles.length !== files.length) {
      return NextResponse.json(
        { ok: false, error: "Ø§Ù„ØµÙŠØº Ø§Ù„Ù…Ù‚Ø¨ÙˆÙ„Ø©: JPG / PNG / WEBP / PDF" },
        { status: 400 },
      );
    }
    if (pdfFiles.length > 1) {
      return NextResponse.json(
        { ok: false, error: "Ù…Ù„Ù PDF ÙˆØ§Ø­Ø¯ ÙÙ‚Ø· Ù„ÙƒÙ„ Ø§Ø³ØªÙŠØ±Ø§Ø¯" },
        { status: 400 },
      );
    }
    for (const f of pdfFiles) {
      if (f.size > maxPdfMB * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: `Ø§Ù„Ù€ PDF Ø£ÙƒØ¨Ø± Ù…Ù† ${maxPdfMB}MB` },
          { status: 400 },
        );
      }
    }

    const sourceType = pdfFiles.length > 0 ? "pdf" : "images";
    const jobId = `aij_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tempFiles: { path: string }[] = [];

    try {
      if (sourceType === "pdf") {
        const pdf = pdfFiles[0];
        const bytes = Buffer.from(await pdf.arrayBuffer());
        const path = await putTempFile(jobId, "menu.pdf", bytes, "application/pdf");
        tempFiles.push({ path });
        // Ø¹Ø¯Ø¯ ØµÙØ­Ø§Øª Ø§Ù„Ù€ PDF ÙŠÙÙƒØªØ´Ù Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ­Ù„ÙŠÙ„ (Files API) â€” ØªÙ‚Ø¯ÙŠØ±ÙŠ Ø§Ù„Ø¢Ù† Ù…Ù† Ø§Ù„Ø­Ø¬Ù…
        const estimatedPages = Math.min(maxPages, Math.max(1, Math.ceil(pdf.size / 300_000)));
        await prisma.aiMenuImportJob.create({
          data: {
            id: jobId,
            restaurantId: restaurant.id,
            status: "UPLOADED",
            sourceType,
            sourceFileCount: 1,
            sourcePageCount: estimatedPages,
            tempFiles: tempFiles as unknown as object,
            currency: "EGP",
            expiresAt,
          },
        });
      } else {
        for (let i = 0; i < imageFiles.length; i++) {
          const img = imageFiles[i];
          if (img.size > 12 * 1024 * 1024) {
            throw new Error(`Ø§Ù„ØµÙˆØ±Ø© ${i + 1} Ø£ÙƒØ¨Ø± Ù…Ù† 12MB`);
          }
          const bytes = Buffer.from(await img.arrayBuffer());
          const size = await imageSizeOf(bytes);
          if (!size) throw new Error(`Ø§Ù„Ù…Ù„Ù ${i + 1} Ù„ÙŠØ³ ØµÙˆØ±Ø© ØµØ§Ù„Ø­Ø©`);
          const ext = img.type === "image/png" ? "png" : img.type === "image/webp" ? "webp" : "jpg";
          const path = await putTempFile(jobId, `page-${i + 1}.${ext}`, bytes, img.type);
          tempFiles.push({ path });
        }
        await prisma.aiMenuImportJob.create({
          data: {
            id: jobId,
            restaurantId: restaurant.id,
            status: "UPLOADED",
            sourceType,
            sourceFileCount: imageFiles.length,
            sourcePageCount: imageFiles.length,
            tempFiles: tempFiles as unknown as object,
            currency: "EGP",
            expiresAt,
          },
        });
      }
    } catch (e) {
      // ÙØ´Ù„ Ø±ÙØ¹ Ø¬Ø²Ø¦ÙŠ â†’ Ù†Ø¸Ù‘Ù Ù…Ø§ Ø±ÙÙØ¹
      const { deleteTempFiles } = await import("@/lib/ai-menu/temp-storage");
      await deleteTempFiles(tempFiles.map((t) => t.path));
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "ÙØ´Ù„ Ø§Ù„Ø±ÙØ¹" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      jobId,
      sourceType,
      fileCount: files.length,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("[ai-menu/upload]", e);
    return NextResponse.json(
      { ok: false, error: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø±ÙØ¹" },
      { status: 500 },
    );
  }
}

