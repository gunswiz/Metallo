"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/client";
import { TESTE_ONLINE_VAPID_PUBLICA } from "@/09_CONFIGURACOES/ambiente-teste-online";

// Marco 3P: ligar/desligar avisos no celular (Web Push) neste aparelho e testar.
type Estado = "carregando" | "sem_suporte" | "iphone_instalar" | "negado" | "desligado" | "ligado";

export function chaveVapid(base64url: string) {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

export function AvisosCelular({ compacto = false }: { compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (vivo) setEstado(ios && !instalado ? "iphone_instalar" : "sem_suporte"); return;
      }
      if (Notification.permission === "denied") { if (vivo) setEstado("negado"); return; }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (vivo) setEstado(sub ? "ligado" : "desligado");
    })().catch(() => vivo && setEstado("sem_suporte"));
    return () => { vivo = false; };
  }, []);

  async function ligar() {
    setOcupado(true); setMensagem("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setEstado(permissao === "denied" ? "negado" : "desligado"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(TESTE_ONLINE_VAPID_PUBLICA) });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const { error } = await createClient().rpc("save_push_subscription_3p" as never, {
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth } as never);
      if (error) { await sub.unsubscribe(); throw error; }
      setEstado("ligado"); setMensagem("Avisos ligados neste aparelho.");
    } catch { setMensagem("Não foi possível ligar os avisos agora. Tente de novo."); }
    finally { setOcupado(false); }
  }
  async function desligar() {
    setOcupado(true); setMensagem("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await createClient().rpc("delete_push_subscription_3p" as never, { p_endpoint: sub.endpoint } as never); await sub.unsubscribe(); }
      setEstado("desligado"); setMensagem("Avisos desligados neste aparelho.");
    } catch { setMensagem("Não foi possível desligar agora."); }
    finally { setOcupado(false); }
  }
  async function testar() {
    setOcupado(true); setMensagem("");
    const { data, error } = await createClient().functions.invoke("lembrete-consumo", { body: { acao: "teste" } });
    setMensagem(!error && data?.ok ? "Aviso de teste enviado. Deve chegar em alguns segundos." : "Não foi possível enviar o teste agora.");
    setOcupado(false);
  }

  const texto: Record<Estado, string> = {
    carregando: "Verificando este aparelho…",
    sem_suporte: "Este navegador não recebe avisos. No celular, use o Chrome (Android) ou instale o Metallo na tela de início.",
    iphone_instalar: "No iPhone: toque em Compartilhar › “Adicionar à Tela de Início”, abra o Metallo pelo ícone e volte aqui.",
    negado: "Os avisos estão bloqueados nas configurações do navegador para este site. Libere em Configurações › Notificações.",
    desligado: "Receba no celular o lembrete do consumo que ainda não foi lançado e, de manhã, os alertas de estoque baixo e de vencimentos (ASO, treinamentos, C.A. de EPI).",
    ligado: "Avisos ligados neste aparelho. Consumo: de segunda a sábado, às 16h30, se faltar lançar. Alertas de estoque e vencimentos: dias úteis, às 7h05, só quando há novidade.",
  };
  // No Início (compacto) só aparece enquanto ainda dá para ligar; depois disso fica só em Minha conta.
  if (compacto && !["desligado", "iphone_instalar"].includes(estado) && !mensagem) return null;
  return <div className={`avisos-celular${compacto ? " compacto" : ""}`} role="region" aria-label="Avisos no celular">
    <BellRing size={22} aria-hidden />
    <div><strong>Avisos no celular</strong><p>{texto[estado]}</p>{mensagem && <p className="avisos-msg" role="status">{mensagem}</p>}</div>
    <div className="avisos-botoes">
      {estado === "desligado" && <button type="button" className="button primary" onClick={ligar} disabled={ocupado}>{ocupado ? "Ligando…" : "Ligar avisos"}</button>}
      {estado === "ligado" && <><button type="button" className="button secondary" onClick={testar} disabled={ocupado}>Enviar teste</button>
        <button type="button" className="button ghost" onClick={desligar} disabled={ocupado}>Desligar</button></>}
    </div>
  </div>;
}
