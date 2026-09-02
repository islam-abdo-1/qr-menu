const key = "AQ.Ab8RN6LJziTOT_1T-rWdTS2C1jsXvYCsqiVx-1fYhxpsVj9kGQ";

const imageModels = [
  "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-lite-image",
];

async function testImageGen(model) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: "A professional photo of grilled chicken on a plate" }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      temperature: 0.7,
    },
  });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(30000),
      }
    );
    const text = await res.text();
    const json = JSON.parse(text);
    const hasImage = json.candidates?.[0]?.content?.parts?.some((p) => p.inlineData);
    console.log(
      `${res.status === 200 && hasImage ? "✅ IMAGE" : res.status === 200 ? "⚠️ 200 no image" : "❌"} ${model}: ${res.status} → ${hasImage ? "IMAGE GENERATED" : text.slice(0, 150)}`
    );
  } catch (e) {
    console.log(`❌ ${model}: ${e.message}`);
  }
}

async function main() {
  for (const m of imageModels) {
    await testImageGen(m);
  }
}
main();
