require('dotenv').config({ path: '.env.local' });
const fetch = require('node-fetch').default;

const text = `Menu
SHAKES
VANILLA SHAKE
CHOCOLATE SHAKE
KITKAT SHAKE
OREO SHAKE
STRAWBERRY SHAKE
BLUEBERRY SHAKE
BUTTER SCOTCH SHAKE
BANANA SHAKE
MANGO SHAKE
BUBBLEGUM SHAKE
·149
<149
<149
<149
<149
<149
<149
<149
<149
2149
PIZZA PASTA
RED SAUCE PASTA
WHITE SAUCE PASTA
MIXED SAUCE PASTA
GARLIC BREAD 4PC
CHEESE GARLIC BREAD 4PC
PIZZA MEXICAN
PIZZA FARM HOUSE
PIZZA VEG EXTRAVAGANZA
PIZZA CORN PANEER
PIZZA ONION TOMATO
PIZZA PEPPY PANEER
PIZZA CAPSICUM ONION
COOLERS
VIRGIN MOJITO
WATERMELON REFRESHER
MASALA MANGO MOJITO
MANGO TWIST
MANGO LEMONADE
ORANGE FRESH
PAAN MOJITO
BLUE LAGOON
COCONUT COOLER
GRAPE FRUIT SPRITZ
CINDRELLA
TROPICAL SUNRISE
MASALA COLA
FRESH LIME SODA
MASALA SHIKANJI
STRAWBERRY LEMON SPLASH
‹125
2125
<125
2125
2125
2149
<125
2149
{149
{149
<149
{149
<80
R70
280
<149
BURGER
CRISPY VEG PATTY BURGER
CRISPY VEG PATTY CHEESE BURGER
PANEER BURGER
PANEER CHEESE BURGER`;

const prompt = `Extract menu from OCR text. Return JSON:
{
  "restaurant": {"name": "string", "currency": "string"},
  "categories": [{"name": "string", "description": "string", "order": 0, "categoryType": "MAIN_DISH", "categoryConfidence": 0.9, "items": [{"name": "string", "description": "string", "price": 0, "variants": [], "image": {"detected": false, "confidence": 0, "region": {"x": 0, "y": 0, "w": 0, "h": 0}}, "sourcePage": 1, "confidence": 0.9}]}]
}

OCR: ${text}`;

async function test() {
  const keys = process.env.GROQ_API_KEYS.split(',');
  const key = keys[0];
  
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ 
      model: 'qwen/qwen3.8-27b', 
      messages: [
        { role: 'system', content: 'Return ONLY valid JSON matching the exact schema. No extra text.' },
        { role: 'user', content: prompt }
      ], 
      max_tokens: 2000, 
      temperature: 0.1, 
      response_format: { type: 'json_object' } 
    })
  });
  
  const data = await res.json();
  console.log('Status:', res.status);
  if (data.error) console.log('Error:', data.error.message);
  else console.log('Result:', JSON.stringify(data.choices[0].message.content, null, 2));
}

test().catch(console.error);