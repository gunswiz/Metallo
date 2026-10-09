// Metallo — avisos no celular (Marco 3P). Só mostra o aviso e abre a tela certa ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = typeof data.title === "string" ? data.title.slice(0, 80) : "Metallo";
  const body = typeof data.body === "string" ? data.body.slice(0, 240) : "Você tem um aviso no Metallo.";
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/dashboard";
  event.waitUntil(self.registration.showNotification(title, { body, icon: "/metallo-app-icon.png", badge: "/metallo-app-icon.png", data: { url }, lang: "pt-BR" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/dashboard", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) if (client.url.startsWith(self.location.origin) && "focus" in client) { client.navigate(url); return client.focus(); }
    return self.clients.openWindow(url);
  }));
});
