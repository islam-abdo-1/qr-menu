require('dotenv').config({ path: '.env.local' });

async function testModel(model, key) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + key 
      },
      body: JSON.stringify({ 
        model: model, 
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Return JSON: {"greeting":"hello"}' }
        ], 
        max_tokens: 50, 
        response_format: { 
          type: 'json_object', 
          schema: { type: 'object', properties: { greeting: { type: 'string' } } } 
        } 
      })
    });
    const t = await r.text();
    return model + ': ' + r.status + ' ' + t.substring(0, 150);
  } catch (e) { 
    return model + ': ERR ' + e.message; 
  }
}

async function main() {
  const keys = process.env.GROQ_API_KEYS.split(',');
  const key = keys[0];
  const models = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'groq/compound-mini'];
  
  for (const m of models) {
    const result = await testModel(m, key);
    console.log(result);
  }
}

main().catch(console.error);