/* eslint-disable @typescript-eslint/no-unused-vars -- JavaScript antigo (ES5) exige o nome no "catch (e)". */
/* Marco 7A (Bloco 4) — celulares antigos.
   Roda ANTES do app. Completa funções que o Chrome antigo (Android 7, 8, 9 sem atualização) não tem
   e, se o navegador for antigo demais para o app, mostra um aviso simples em vez de uma tela branca.
   Sem dados pessoais, sem rede. Escrito em JavaScript antigo (ES5) de propósito. */
(function () {
  "use strict";
  var w = window;
  function def(obj, nome, valor) {
    if (obj && !(nome in obj)) { try { Object.defineProperty(obj, nome, { value: valor, writable: true, configurable: true }); } catch (e) { obj[nome] = valor; } }
  }
  // Array/String .at() — Chrome 92.
  function at(i) { var n = Math.trunc ? Math.trunc(i) || 0 : (i | 0); if (n < 0) n += this.length; return n < 0 || n >= this.length ? undefined : this[n]; }
  def(Array.prototype, "at", at);
  def(String.prototype, "at", function (i) { var s = String(this); var c = at.call(s, i); return c; });
  // Object.hasOwn — Chrome 93.
  def(Object, "hasOwn", function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  // String.replaceAll (só com texto) — Chrome 85.
  def(String.prototype, "replaceAll", function (busca, troca) {
    if (busca instanceof RegExp) return String(this).replace(busca, troca);
    return String(this).split(String(busca)).join(String(troca));
  });
  // crypto.randomUUID — Chrome 92.
  if (w.crypto && w.crypto.getRandomValues) def(w.crypto, "randomUUID", function () {
    var b = new Uint8Array(16); w.crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = []; for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
    return h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" + h.slice(6, 8).join("") + "-" + h.slice(8, 10).join("") + "-" + h.slice(10).join("");
  });
  // structuredClone (dados simples) — Chrome 98.
  def(w, "structuredClone", function (v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); });
  // AbortSignal.timeout — Chrome 103; AbortSignal.any — Chrome 116. Usados em todas as chamadas do app.
  if (w.AbortController && w.AbortSignal) {
    def(AbortSignal, "timeout", function (ms) {
      var c = new AbortController();
      setTimeout(function () { try { c.abort(new DOMException("Tempo esgotado", "TimeoutError")); } catch (e) { c.abort(); } }, ms);
      return c.signal;
    });
    def(AbortSignal, "any", function (sinais) {
      var c = new AbortController();
      function parar(s) { return function () { if (!c.signal.aborted) { try { c.abort(s.reason); } catch (e) { c.abort(); } } }; }
      for (var i = 0; i < sinais.length; i++) {
        var s = sinais[i];
        if (s.aborted) { parar(s)(); break; }
        s.addEventListener("abort", parar(s), { once: true });
      }
      return c.signal;
    });
  }
  // Navegador antigo demais (sem Promise, fetch ou sintaxe moderna): aviso em vez de tela branca.
  var antigo = !w.Promise || !w.fetch || !w.AbortController;
  if (!antigo) { try { new Function("var a = {}; return a?.b ?? (async () => 1)"); } catch (e) { antigo = !(e && e.name === "EvalError"); } }
  if (antigo) {
    var mostrar = function () {
      if (document.getElementById("aviso-navegador-antigo")) return;
      var d = document.createElement("div");
      d.id = "aviso-navegador-antigo";
      d.setAttribute("role", "alert");
      d.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483647;padding:20px;background:#ffd18a;color:#111;font:700 19px/1.45 sans-serif";
      d.innerHTML = "Este celular está com o navegador muito antigo para o Metallo.<br>Abra a <b>Play Store</b>, procure <b>Google Chrome</b> e toque em <b>Atualizar</b>. Depois abra o Metallo de novo.";
      (document.body || document.documentElement).appendChild(d);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mostrar); else mostrar();
  }
})();
