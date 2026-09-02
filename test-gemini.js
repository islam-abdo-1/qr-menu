const key = "AQ.Ab8RN6LJziTOT_1T-rWdTS2C1jsXvYCsqiVx-1fYhxpsVj9kGQ";
const body = JSON.stringify({
  contents: [{ parts: [{ text: "Say hello" }] }],
});

fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": key,
  },
  body,
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.slice(0, 500)}`);
  })
  .catch((e) => console.error("Error:", e.message));
