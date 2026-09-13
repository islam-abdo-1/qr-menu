require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function testOCRAndGroq() {
  const fs = require('fs');
  
  // Read test image
  const imagePath = 'C:\\Users\\islam\\OneDrive\\Desktop\\QR\\imeg\\1124140757051928227.jpg';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  
  console.log('Image size:', imageBuffer.length, 'bytes');
  
  // Test OCR
  const FormData = require('form-data');
  const fetch = require('node-fetch').default;
  
  const form = new FormData();
  form.append('base64Image', `data:image/jpeg;base64,${base64}`);
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('apikey', 'helloworld');
  
  console.log('\n=== OCR Request ===');
  const ocrRes = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
    headers: form.getHeaders ? form.getHeaders() : {},
  });
  
  const ocrData = await ocrRes.json();
  console.log('OCR Exit Code:', ocrData.OCRExitCode);
  console.log('OCR Error:', ocrData.IsErroredOnProcessing ? ocrData.ErrorMessage : 'None');
  
  const text = ocrData.ParsedResults?.[0]?.ParsedText;
  if (!text) {
    console.log('OCR failed - no text extracted');
    return;
  }
  
  console.log('\n=== OCR Text (first 1000 chars) ===');
  console.log(text.substring(0, 1000));
  
  // Now test Groq with the OCR text
  console.log('\n=== Testing Groq ===');
  const groqKeys = process.env.GROQ_API_KEYS.split(',');
  const models = ['qwen/qwen3.8-27b', 'groq/compound-mini', 'qwen/qwen3.6-27b'];
  
  const prompt = `استخرج من نص OCR التالي قائمة منيو منظمة:\n\n${text}\n\nقم باستخراج الأصناف والأسعار والفئات. أرجع JSON فقط.`;
  
  for (const model of models) {
    for (const key of groqKeys) {
      try {
        console.log(`\nTrying model: ${model} with key ending in ${key.slice(-4)}`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer ' + key 
          },
          body: JSON.stringify({ 
            model: model, 
            messages: [
              { role: 'system', content: 'You are a menu analyzer. Extract structured menu data from OCR text.' },
              { role: 'user', content: prompt }
            ], 
            max_tokens: 2000, 
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });
        
        const data = await res.json();
        console.log('Status:', res.status);
        if (data.error) {
          console.log('Error:', data.error.message);
        } else {
          console.log('Success! Response:', JSON.stringify(data.choices[0].message.content, null, 2).substring(0, 500));
          return; // Success
        }
      } catch(e) {
        console.log('Exception:', e.message);
      }
    }
  }
  
  console.log('\nAll models failed');
}

testOCRAndGroq().catch(console.error).finally(() => p.$disconnect());