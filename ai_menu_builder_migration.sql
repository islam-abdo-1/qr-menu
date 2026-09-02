-- Migration: ai_menu_builder
-- 5 جداول جديدة لميزة AI Menu Builder

-- ═══ 1. طلبات الاستيراد ═══
CREATE TABLE "AiMenuImportJob" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "sourceType" TEXT NOT NULL,
    "sourceFileCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "tempFiles" JSONB,
    "geminiFiles" JSONB,
    "detectedCategoryCount" INTEGER NOT NULL DEFAULT 0,
    "detectedItemCount" INTEGER NOT NULL DEFAULT 0,
    "extractedImageCount" INTEGER NOT NULL DEFAULT 0,
    "generatedImageCount" INTEGER NOT NULL DEFAULT 0,
    "failedImageCount" INTEGER NOT NULL DEFAULT 0,
    "imageMode" TEXT NOT NULL DEFAULT 'SMART',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "errorMessage" TEXT,
    "providerUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMenuImportJob_pkey" PRIMARY KEY ("id")
);

-- ═══ 2. أصناف مستخرجة ═══
CREATE TABLE "AiMenuImportItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "categoryType" TEXT,
    "categoryOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "sizeMode" TEXT NOT NULL DEFAULT 'letters',
    "variants" JSONB,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReasons" JSONB,
    "priceConfidence" DOUBLE PRECISION,
    "categoryConfidence" DOUBLE PRECISION,
    "imageDetected" BOOLEAN NOT NULL DEFAULT false,
    "imageSource" TEXT NOT NULL DEFAULT 'NONE',
    "imageConfidence" DOUBLE PRECISION,
    "imagePage" INTEGER,
    "imageRegion" JSONB,
    "tempImagePath" TEXT,
    "finalImageUrl" TEXT,
    "finalImageMeta" JSONB,
    "generationStatus" TEXT,
    "generationError" TEXT,
    "imageModeOverride" TEXT,
    "sourcePage" INTEGER,
    "sourceOrder" INTEGER NOT NULL DEFAULT 0,
    "importedMenuItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMenuImportItem_pkey" PRIMARY KEY ("id")
);

-- ═══ 3. قوالب الأنماط ═══
CREATE TABLE "AiMenuStyle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryType" TEXT NOT NULL,
    "styleConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMenuStyle_pkey" PRIMARY KEY ("id")
);

-- ═══ 4. صور مرجعية للأنماط ═══
CREATE TABLE "AiMenuStyleReference" (
    "id" TEXT NOT NULL,
    "styleId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMenuStyleReference_pkey" PRIMARY KEY ("id")
);

-- ═══ 5. سجل استهلاك الـ AI ═══
CREATE TABLE "AiUsageLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restaurantId" TEXT,
    "jobId" TEXT,
    "requestType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "keyFingerprint" TEXT,
    "status" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- ═══ الفهارس ═══
CREATE INDEX "AiMenuImportJob_restaurantId_idx" ON "AiMenuImportJob"("restaurantId");
CREATE INDEX "AiMenuImportJob_status_expiresAt_idx" ON "AiMenuImportJob"("status", "expiresAt");
CREATE INDEX "AiMenuImportItem_jobId_idx" ON "AiMenuImportItem"("jobId");
CREATE INDEX "AiMenuImportItem_restaurantId_idx" ON "AiMenuImportItem"("restaurantId");
CREATE INDEX "AiMenuStyleReference_styleId_idx" ON "AiMenuStyleReference"("styleId");
CREATE INDEX "AiUsageLog_createdAt_idx" ON "AiUsageLog"("createdAt");
CREATE INDEX "AiUsageLog_restaurantId_createdAt_idx" ON "AiUsageLog"("restaurantId", "createdAt");

-- ═══ المفاتيح الأجنبية ═══
ALTER TABLE "AiMenuImportJob" ADD CONSTRAINT "AiMenuImportJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMenuImportItem" ADD CONSTRAINT "AiMenuImportItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AiMenuImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiMenuStyleReference" ADD CONSTRAINT "AiMenuStyleReference_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "AiMenuStyle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ قيد فريد للـ slug ═══
ALTER TABLE "AiMenuStyle" ADD CONSTRAINT "AiMenuStyle_slug_key" UNIQUE ("slug");
