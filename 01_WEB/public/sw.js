// Metallo — service worker.
// Marco 3P/3U: avisos no celular (Gestão e app do Funcionário). Só mostra o aviso e abre a tela certa ao tocar.
// Marco 4K: no app do Funcionário (registrado com ?app=funcionario) guarda as telas e arquivos do app para ele
// abrir mesmo sem internet — e o ponto continuar funcionando. Nunca guarda respostas de /api (dados pessoais).
const FUNCIONARIO = new URL(self.location.href).searchParams.get("app") === "funcionario";
const INICIO = FUNCIONARIO ? "/colaborador/inicio" : "/dashboard";
const CACHE = "metallo-funcionario-v1";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    if (FUNCIONARIO) { try { const c = await caches.open(CACHE); await c.addAll(["/colaborador/inicio", "/colaborador/ponto"]); } catch { /* sem internet na instalação */ } }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  for (const nome of await caches.keys()) if (nome.startsWith("metallo-") && nome !== CACHE) await caches.delete(nome);
  if (!FUNCIONARIO) for (const nome of await caches.keys()) if (nome.startsWith("metallo-")) await caches.delete(nome);
  await self.clients.claim();
})()));

function guardavel(url) {
  return url.origin === self.location.origin && !url.pathname.startsWith("/api/") &&
    (url.pathname.startsWith("/colaborador") || url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_next/static/") ||
      /\.(png|svg|ico|woff2?|css|js)$/.test(url.pathname) || url.pathname.endsWith(".webmanifest"));
}
if (FUNCIONARIO) self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!guardavel(url)) return;
  const imutavel = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_next/static/");
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (imutavel) { const hit = await cache.match(req); if (hit) return hit; }
    try {
      const resp = await fetch(req);
      if (resp.ok && resp.type === "basic") await cache.put(req, resp.clone());
      return resp;
    } catch (erro) {
      const hit = await cache.match(req) || (req.mode === "navigate" ? (await cache.match(req, { ignoreSearch: true }) || await cache.match("/colaborador/ponto") || await cache.match("/colaborador/inicio")) : undefined);
      if (hit) return hit;
      throw erro;
    }
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Metallo";
  const body = typeof data.body === "string" ? data.body.slice(0, 240) : "Você tem um aviso no Metallo.";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : INICIO;
  const tag = typeof data.tag === "string" ? data.tag.slice(0, 60) : undefined;
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/metallo-app-icon.png", badge: "/metallo-app-icon.png", data: { url }, lang: "pt-BR", tag }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? INICIO, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) if (client.url.startsWith(self.location.origin) && "focus" in client) { client.navigate(url); return client.focus(); }
    return self.clients.openWindow(url);
  }));
});
