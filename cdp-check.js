const { spawn } = require("child_process");
const http = require("http");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.argv[2] || "https://qr-menu-lyart-gamma.vercel.app/";
const PORT = 9333;
const log = (...a) => console.log("[cdp]", ...a);

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
    "--user-data-dir=C:\\Users\\islam\\AppData\\Local\\Temp\\opencode\\cdp-profile2",
    "about:blank",
  ], { stdio: "ignore" });
  log("chrome launched");

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const list = await getJson("/json/list");
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch { }
    await sleep(500);
  }
  if (!wsUrl) { log("FAIL no page target"); chrome.kill(); process.exit(1); }
  log("target:", wsUrl.slice(0, 60));

  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    try { ws.send(JSON.stringify({ id: mid, method, params })); }
    catch (e) { reject(e); }
  });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error("CDP " + m.error.message)) : p.resolve(m.result);
    }
  };
  ws.onerror = (e) => log("ws error", e.message);
  await new Promise((r) => (ws.onopen = r));
  log("ws open");

  await send("Page.enable");
  log("page.enable ok");
  await send("Page.navigate", { url: URL });
  log("navigate sent");
  await sleep(9000);
  log("waited 9s");

  const expr = `(() => {
    const rows = [];
    document.querySelectorAll("h3").forEach((h) => {
      const desc = h.nextElementSibling;
      const cs = desc ? getComputedStyle(desc) : null;
      const r = desc ? desc.getBoundingClientRect() : null;
      rows.push({
        name: (h.textContent || "").trim().slice(0, 30),
        descText: desc ? (desc.textContent || "").trim().slice(0, 40) : null,
        color: cs ? cs.color : null,
        fontSize: cs ? cs.fontSize : null,
        visible: r ? (r.width > 0 && r.height > 0) : false
      });
    });
    const hero = document.querySelector("h1");
    return JSON.stringify({
      url: location.href,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      heroColor: hero ? getComputedStyle(hero).color : null,
      heroText: hero ? (hero.textContent || "").slice(0, 40) : null,
      cards: rows
    });
  })()`;

  const out = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  log("eval result keys:", Object.keys(out).join(","));
  if (out.exceptionDetails) log("EXC:", JSON.stringify(out.exceptionDetails).slice(0, 400));
  const ro = out.result;
  console.log(JSON.stringify(JSON.parse(ro.value), null, 1));
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("FATAL", e.stack || e.message); process.exit(1); });
