const key = "AQ.Ab8RN6LJziTOT_1T-rWdTS2C1jsXvYCsqiVx-1fYhxpsVj9kGQ";

const models = [
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
];

async function test(model) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: "Say hello in one word" }] }],
  });
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(15000),
      }
    );
    const text = await res.text();
    const ok = res.status === 200;
    const reply = ok ? JSON.parse(text).candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 50) : text.slice(0, 120);
    console.log(`${ok ? "✅" : "❌"} ${model}: ${res.status} → ${reply}`);
    return ok;
  } catch (e) {
    console.log(`❌ ${model}: ${e.message}`);
    return false;
  }
}

async function main() {
  for (const m of models) {
    await test(m);
  }
}
main();
