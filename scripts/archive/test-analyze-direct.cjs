require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Import the actual server functions
const { getTempFile } = require('./lib/ai-menu/temp-storage');
const { imageSizeOf } = require('./lib/ai-menu/image-service');
const { analyzeMenu } = require('./lib/ai-menu/menu-analyzer');
const { getPlanLimits } = require('./lib/ai-menu/plan-limits');

async function testAnalyzeFlow() {
  // Find a job to test with
  const job = await p.aiMenuImportJob.findFirst({
    where: { status: 'UPLOADED' },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!job) {
    console.log('No UPLOADED job found');
    return;
  }
  
  console.log('Testing job:', job.id);
  
  const tempPaths = (job.tempFiles || []).map(t => t.path);
  console.log('Temp paths:', tempPaths);
  
  if (tempPaths.length === 0) {
    console.log('No temp files');
    return;
  }
  
  // Load images
  const images = [];
  for (let i = 0; i < tempPaths.length; i++) {
    try {
      const buf = await getTempFile(tempPaths[i]);
      console.log('File', i, 'size:', buf.length);
      const size = await imageSizeOf(buf);
      console.log('File', i, 'size info:', size);
      if (!size) continue;
      images.push({
        mimeType: "image/jpeg",
        data: buf.toString("base64"),
        page: i + 1,
      });
    } catch (e) {
      console.error('Error loading file', i, ':', e.message);
    }
  }
  
  console.log('Loaded images:', images.length);
  
  if (images.length === 0) {
    console.log('No valid images');
    return;
  }
  
  // Get restaurant
  const restaurant = await p.restaurant.findUnique({ where: { id: job.restaurantId } });
  console.log('Restaurant:', restaurant?.name);
  
  const limits = await getPlanLimits(restaurant);
  console.log('Plan limits:', limits);
  
  // Call analyzeMenu
  try {
    console.log('Calling analyzeMenu...');
    const output = await analyzeMenu({
      jobId: job.id,
      restaurantId: restaurant.id,
      sourceType: "images",
      images,
      currencyHint: job.currency,
      limits,
    });
    console.log('SUCCESS!', { provider: output.provider, pageCount: output.pageCount });
  } catch (e) {
    console.error('analyzeMenu FAILED:', e.message);
    console.error('Stack:', e.stack);
  }
}

testAnalyzeFlow().catch(console.error).finally(() => p.$disconnect());