require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const sharp = require('sharp');

// Use DIRECT_URL for local script execution (bypasses pgbouncer)
const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  console.error('DIRECT_URL not found in .env.local');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
});

async function generateBlurDataURL(imageUrl: string) {
  try {
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch ${imageUrl}: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Generate blur placeholder (20x20, heavy blur, low quality)
    const blurBuffer = await sharp(buffer)
      .resize(20, 20, { fit: 'inside' })
      .blur(30)
      .webp({ quality: 20 })
      .toBuffer();
    
    return `data:image/webp;base64,${blurBuffer.toString('base64')}`;
  } catch (e) {
    const err = e as Error;
    console.warn(`Error generating blur for ${imageUrl}:`, err.message);
    return null;
  }
}

async function backfillMenuItems() {
  console.log('Starting backfill for MenuItem...');
  
  const items = await prisma.menuItem.findMany({
    where: {
      imageUrl: { not: null },
      imageBlurDataURL: null,
    },
    select: { id: true, imageUrl: true },
  });
  
  console.log(`Found ${items.length} MenuItem(s) to backfill`);
  
  let success = 0;
  let failed = 0;
  
  for (const item of items) {
    if (!item.imageUrl) continue;
    
    const blurDataURL = await generateBlurDataURL(item.imageUrl);
    
    if (blurDataURL) {
      await prisma.menuItem.update({
        where: { id: item.id },
        data: { imageBlurDataURL: blurDataURL },
      });
      success++;
      console.log(`✓ Updated MenuItem ${item.id}`);
    } else {
      failed++;
      console.log(`✗ Failed MenuItem ${item.id}`);
    }
  }
  
  console.log(`MenuItem backfill complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

async function backfillAiMenuItems() {
  console.log('\nStarting backfill for AiMenuImportItem...');
  
  const items = await prisma.aiMenuImportItem.findMany({
    where: {
      finalImageUrl: { not: null },
      finalImageMeta: {
        path: ['blurDataURL'],
        equals: null,
      },
    },
    select: { id: true, finalImageUrl: true, finalImageMeta: true },
  });
  
  console.log(`Found ${items.length} AiMenuImportItem(s) to backfill`);
  
  let success = 0;
  let failed = 0;
  
  for (const item of items) {
    if (!item.finalImageUrl) continue;
    
    const blurDataURL = await generateBlurDataURL(item.finalImageUrl);
    
    if (blurDataURL) {
      const meta = item.finalImageMeta || {};
      await prisma.aiMenuImportItem.update({
        where: { id: item.id },
        data: {
          finalImageMeta: {
            ...meta,
            blurDataURL,
          } as unknown as object,
        },
      });
      success++;
      console.log(`✓ Updated AiMenuImportItem ${item.id}`);
    } else {
      failed++;
      console.log(`✗ Failed AiMenuImportItem ${item.id}`);
    }
  }
  
  console.log(`AiMenuImportItem backfill complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

async function main() {
  console.log('=== BlurDataURL Backfill Script ===\n');
  
  const menuResults = await backfillMenuItems();
  const aiResults = await backfillAiMenuItems();
  
  console.log('\n=== Summary ===');
  console.log(`MenuItem: ${menuResults.success} success, ${menuResults.failed} failed`);
  console.log(`AiMenuImportItem: ${aiResults.success} success, ${aiResults.failed} failed`);
  
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Backfill error:', e);
  await prisma.$disconnect();
  process.exit(1);
});