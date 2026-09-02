const key2 = "AQ.Ab8RN6LjzEvCZLW9XpHtW331_NwNzlHXzEtyDFu1YBWxgWZYRw";
const key3 = "AQ.Ab8RN6JiSH2NKX_6nFxFTKGbTURSyJuEakNhxQRP5knjApiFnQ";

async function test(label, key) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: "A burger photo" }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 0.7 },
  });
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body, signal: AbortSignal.timeout(25000) }
    );
    const text = await res.text();
    const json = JSON.parse(text);
    const hasImg = json.candidates?.[0]?.content?.parts?.some(p => p.inlineData);
    console.log(`${label}: ${hasImg ? "✅ IMAGE" : `❌ ${res.status} ${text.slice(0,100)}`}`);
  } catch (e) {
    console.log(`${label}: ❌ ${e.message.slice(0,80)}`);
  }
}

Promise.all([
  test("Key-2", key2),
  test("Key-3", key3),
]).then(() => process.exit(0));
