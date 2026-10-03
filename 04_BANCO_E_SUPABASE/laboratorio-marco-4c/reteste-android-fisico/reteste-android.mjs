// Marco 4C — reteste no Android físico (USB/ADB) dos achados F-4C-ANDROID-01/02 após a correção.
// Somente PC local + USB: adb reverse 3101/54321 e DevTools do Chrome via adb forward (loopback).
// Contas sintéticas. Restaura TODAS as configurações do aparelho no final. SIMULAÇÃO SEM VALOR OFICIAL.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ADB = join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk", "platform-tools", "adb.exe");
const adb = (...args) => execFileSync(ADB, args, { encoding: "utf8", timeout: 30000 }).trim();
const sh = command => { try { return adb("shell", command); } catch (error) { return `ERRO: ${String(error.stderr || error.message).trim().slice(0, 200)}`; } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const creds = JSON.parse(readFileSync(join(here, "..", "..", "..", "backups", "credenciais-previa-3h.json"), "utf8"));
const out = { at: new Date().toISOString(), scope: "Marco 4C — reteste Android físico após correção; SIMULAÇÃO SEM VALOR OFICIAL", device: {}, cases: [] };
const record = (name, status, detail) => { out.cases.push({ name, status, ...detail }); console.log(JSON.stringify({ name, status })); };
const shots = join(here, "capturas"); mkdirSync(shots, { recursive: true });

// ---------- CDP mínimo (Node 24 tem WebSocket nativo) ----------
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener("message", event => { const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) { const { ok, fail } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result); }
      else if (msg.method) for (const listener of this.listeners) listener(msg); }); }
  static async open(url) { const ws = new WebSocket(url); await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; }); return new Cdp(ws); }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((ok, fail) => { this.pending.set(id, { ok, fail }); setTimeout(() => fail(new Error(`timeout ${method}`)), 30000); }); }
  async eval(expression) { const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; }
  close() { this.ws.close(); }
}
async function waitFor(cdp, expression, ms = 25000) { const end = Date.now() + ms; while (Date.now() < end) { try { if (await cdp.eval(expression)) return true; } catch { /* navegação em curso */ } await sleep(400); } return false; }
async function tap(cdp, selectorText, times = 1) {
  const rect = await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(selectorText)}); if(!b) return null; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  if (!rect) throw new Error(`botão ausente: ${selectorText}`);
  for (let i = 0; i < times; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x, y: rect.y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    if (times > 1) await sleep(60);
  }
}
async function shot(cdp, name) { try { const r = await cdp.send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(shots, name), Buffer.from(r.data, "base64")); return name; } catch { return null; } }

const ORIGIN = "http://127.0.0.1:3101";
let cdp, posts = 0;
const original = {};
try {
  out.device = { model: sh("getprop ro.product.model"), android: sh("getprop ro.build.version.release"), chrome: (sh("dumpsys package com.android.chrome | grep -m1 versionName").split("=")[1] || "").trim() };
  original.fine = sh("cmd appops get --uid com.android.chrome FINE_LOCATION");
  original.coarse = sh("cmd appops get --uid com.android.chrome COARSE_LOCATION");
  original.locationEnabled = sh("cmd location is-location-enabled");
  original.density = sh("wm density"); original.font = sh("settings get system font_scale");
  out.device.originalState = { fine: original.fine, coarse: original.coarse, locationEnabled: original.locationEnabled, density: original.density, font: original.font };
  for (const port of ["3101", "54321"]) adb("reverse", `tcp:${port}`, `tcp:${port}`);
  adb("forward", "tcp:9222", "localabstract:chrome_devtools_remote");
  sh(`am start -n com.android.chrome/com.google.android.apps.chrome.Main -d ${ORIGIN}/colaborador/login`);
  await sleep(4000);
  // Usa a aba aberta pelo am start; se não houver, tenta criar uma.
  let target = null;
  for (let i = 0; i < 10 && !target; i++) {
    const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
    target = list.find(t => t.type === "page" && t.url.startsWith(ORIGIN));
    if (!target) await sleep(1500);
  }
  if (!target) { const raw = await (await fetch(`http://127.0.0.1:9222/json/new?${ORIGIN}/colaborador/login`, { method: "PUT" })).text();
    try { target = JSON.parse(raw); } catch { throw new Error(`DevTools do Chrome: ${raw.slice(0, 120)}`); } }
  cdp = await Cdp.open(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");
  cdp.listeners.push(msg => { if (msg.method === "Network.requestWillBeSent" && msg.params.request.method === "POST" && msg.params.request.url.endsWith("/api/ponto-online/events")) posts++; });
  for (const origin of [ORIGIN, "http://127.0.0.1:54321"]) await cdp.send("Storage.clearDataForOrigin", { origin, storageTypes: "all" });
  out.device.viewport = await cdp.eval("({w:innerWidth,h:innerHeight,dpr:devicePixelRatio})");

  async function login(user) {
    await cdp.send("Page.navigate", { url: `${ORIGIN}/colaborador/login` });
    if (!await waitFor(cdp, "!!document.querySelector('#email')")) throw new Error("login indisponível");
    await cdp.eval(`(() => { const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      for (const [s,v] of [['#email',${JSON.stringify(user.email)}],['#password',${JSON.stringify(user.password)}]]) { const e=document.querySelector(s); set.call(e,v); e.dispatchEvent(new Event('input',{bubbles:true})); }
      document.querySelector('form').requestSubmit(); return true; })()`);
    if (!await waitFor(cdp, "location.pathname.endsWith('/colaborador/inicio')", 20000)) throw new Error("login não concluiu");
    await cdp.send("Page.navigate", { url: `${ORIGIN}/colaborador/ponto` });
    if (!await waitFor(cdp, "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Registrar ponto')", 20000)) throw new Error("Meu Ponto indisponível");
  }
  async function mark(label, { taps = 1 } = {}) {
    const before = posts; const started = Date.now();
    await tap(cdp, "Registrar ponto", taps);
    const done = await waitFor(cdp, "[...document.querySelectorAll('h2,h3,strong')].some(e=>e.textContent.trim()==='Ponto registrado') || [...document.querySelectorAll('button')].some(b=>b.textContent.includes('reenviar'))", 30000);
    const text = await cdp.eval("document.body.innerText");
    const ok = /Ponto registrado/.test(text) && !text.includes("reenviar a mesma intenção");
    const location = ["Permissão de localização negada", "Localização indisponível", "Tempo de localização esgotado", "Localização com baixa precisão", "Localização disponível", "Localização não comprovada"].find(l => text.includes(l)) ?? null;
    const result = { ok, done, ms: Date.now() - started, posts: posts - before, location, image: await shot(cdp, `${label}.png`) };
    await cdp.eval("location.reload()"); await waitFor(cdp, "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Registrar ponto')", 20000);
    return result;
  }

  await login(creds.joao);
  record("login João e Meu Ponto no Android", "APROVADO", {});

  // A — localização bloqueada pelo Android (o caso que travava)
  sh("cmd appops set --uid com.android.chrome FINE_LOCATION ignore"); sh("cmd appops set --uid com.android.chrome COARSE_LOCATION ignore");
  try { const r = await mark("A-localizacao-bloqueada"); record("A — localização bloqueada pelo Android", r.ok && r.posts === 1 && r.location !== "Localização disponível" ? "APROVADO" : "REPROVADO", r); }
  finally { const mode = s => (s.match(/Uid mode:\s*\w+:\s*(\w+)/) || [])[1] || "foreground"; sh(`cmd appops set --uid com.android.chrome FINE_LOCATION ${mode(original.fine)}`); sh(`cmd appops set --uid com.android.chrome COARSE_LOCATION ${mode(original.coarse)}`); }

  // B — localização do aparelho desligada
  if (original.locationEnabled === "true") {
    sh("cmd location set-location-enabled false");
    try { const r = await mark("B-localizacao-desligada"); record("B — localização do aparelho desligada", r.ok && r.posts === 1 && r.location !== "Localização disponível" ? "APROVADO" : "REPROVADO", r); }
    finally { sh("cmd location set-location-enabled true"); }
  } else record("B — localização do aparelho desligada", "NÃO VERIFICÁVEL", { reason: `estado inicial: ${original.locationEnabled}` });

  // C — localização normal (regressão) e D — duplo toque
  await sleep(2000);
  const c = await mark("C-localizacao-normal"); record("C — localização permitida (regressão)", c.ok && c.posts === 1 ? "APROVADO" : "REPROVADO", c);
  const d = await mark("D-duplo-toque", { taps: 2 }); record("D — duplo toque gera uma marcação", d.ok && d.posts === 1 ? "APROVADO" : "REPROVADO", d);

  // E — exibição e fonte ampliadas (≈2×), como no teste que falhou
  const physical = Number((original.density.match(/Physical density:\s*(\d+)/) || [])[1] || 0);
  const override = (original.density.match(/Override density:\s*(\d+)/) || [])[1];
  if (physical) {
    sh(`wm density ${physical * 2}`); sh("settings put system font_scale 1.62");
    try {
      await sleep(5000); await cdp.eval("location.reload()"); await waitFor(cdp, "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Registrar ponto')", 25000);
      const m = await cdp.eval(`(() => { const vw=innerWidth; const doc=document.documentElement.scrollWidth;
        const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Registrar ponto').getBoundingClientRect();
        const cut=[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>vw+1 || r.left<-1);}).length;
        return {viewport:vw, pageWidth:doc, horizontalScroll:doc>vw+1, button:{left:btn.left,right:btn.right,width:btn.width,height:btn.height}, buttonInside:btn.left>=0&&btn.right<=vw+1, elementsOutside:cut}; })()`);
      const image = await shot(cdp, "E-exibicao-2x.png");
      record("E — exibição e fonte ampliadas (~2×)", !m.horizontalScroll && m.buttonInside && m.elementsOutside === 0 ? "APROVADO" : "REPROVADO", { ...m, image });
    } finally { if (override) sh(`wm density ${override}`); else sh("wm density reset"); sh(`settings put system font_scale ${original.font}`); await sleep(3000); }
  } else record("E — exibição ampliada", "NÃO VERIFICÁVEL", { reason: "densidade física não lida" });

  // F — bloquear e desbloquear a tela com Meu Ponto aberto
  const beforeLock = posts;
  const sleepKey = sh("input keyevent 223");
  if (sleepKey.startsWith("ERRO")) record("F — bloqueio/desbloqueio", "NÃO VERIFICÁVEL", { reason: "o sistema do aparelho recusa comando de tecla (INJECT_EVENTS); fazer manualmente se necessário" });
  else { await sleep(8000); sh("input keyevent 224"); await sleep(4000);
    const alive = await waitFor(cdp, "document.visibilityState==='visible' || true", 5000);
    record("F — bloqueio/desbloqueio sem marcação automática", posts === beforeLock && alive ? "APROVADO" : "REPROVADO", { postsDuring: posts - beforeLock, note: "tela pode continuar bloqueada por PIN; nenhum PIN foi usado" }); }
} catch (error) {
  record("execução", "INTERROMPIDA", { error: String(error.message).slice(0, 300) });
} finally {
  try { if (cdp) cdp.close(); } catch { /* */ }
  try { adb("forward", "--remove", "tcp:9222"); } catch { /* */ }
  for (const port of ["3101", "54321"]) { try { adb("reverse", "--remove", `tcp:${port}`); } catch { /* */ } }
  out.device.finalState = { fine: sh("cmd appops get --uid com.android.chrome FINE_LOCATION"), coarse: sh("cmd appops get --uid com.android.chrome COARSE_LOCATION"), locationEnabled: sh("cmd location is-location-enabled"), density: sh("wm density"), font: sh("settings get system font_scale") };
  out.restored = out.device.finalState.locationEnabled === original.locationEnabled && out.device.finalState.font === original.font;
  writeFileSync(join(here, "resultado.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ restored: out.restored, summary: out.cases.map(c => `${c.status}: ${c.name}`) }, null, 1));
}
