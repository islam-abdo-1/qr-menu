const { spawn } = require("child_process");
const http = require("http");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "https://qr-menu-lyart-gamma.vercel.app/";
const PORT = 9334;

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "127.0.0.1", port: PORT, path }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=C:\\Users\\islam\\AppData\\Local\\Temp\\opencode\\cdp-profile3",
    "about:blank",
  ], { stdio: "ignore" });

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const list = await getJson("/json/list");
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch { }
    await sleep(500);
  }
  if (!wsUrl) { chrome.kill(); process.exit(1); }

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error("CDP " + m.error.message)) : p.resolve(m.result);
    }
  };
  await new Promise((r) => (ws.onopen = r));

  await send("Page.enable");
  await send("Page.navigate", { url: URL });
  await sleep(9000);

  const expr = `(() => {
    const cs = (sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el) : null;
    };
    const html = cs("html"), body = cs("body"), main = cs("main"), article = cs("article"), h3 = cs("h3"), cat = cs(".text-gold-gradient");
    const root = getComputedStyle(document.documentElement);
    const v = (n) => root.getPropertyValue(n).trim();
    const heads = [...document.querySelectorAll("h1, h2, h3, h4")].slice(0, 8).map((el) => ({
      tag: el.tagName,
      cls: (el.className || "").toString().slice(0, 60),
      text: (el.textContent || "").trim().slice(0, 25),
      color: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor
    }));
    const cats = [...document.querySelectorAll(".text-gold-gradient")].slice(0, 4).map((el) => ({
      text: (el.textContent || "").trim().slice(0, 25),
      color: getComputedStyle(el).color
    }));
    return JSON.stringify({
      htmlBg: html ? html.backgroundColor : null,
      bodyBg: body ? body.backgroundColor : null,
      mainBg: main ? main.backgroundColor : null,
      articleBg: article ? article.backgroundColor : null,
      h3Color: h3 ? h3.color : null,
      goldGrads: cats,
      headings: heads,
      vars: { bg: v("--background"), card: v("--card"), fg: v("--foreground"), primary: v("--primary") },
      htmlClass: document.documentElement.className.slice(0, 80)
    });
  })()`;

  const out = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (out.exceptionDetails) { console.error("EXC:", JSON.stringify(out.exceptionDetails).slice(0, 300)); process.exit(1); }
  console.log(out.result.value);
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("FATAL", e.stack || e.message); process.exit(1); });
