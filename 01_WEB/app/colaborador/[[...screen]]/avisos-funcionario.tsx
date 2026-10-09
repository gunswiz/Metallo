"use client";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { chaveVapid } from "@/02_COMPONENTES_VISUAIS/avisos-celular";
import { TESTE_ONLINE_VAPID_PUBLICA } from "@/09_CONFIGURACOES/ambiente-teste-online";
import type { AvisosEstado3u } from "@/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session";
import styles from "./colaborador.module.css";

// Marco 3U: avisos no celular do funcionário — lembrete na hora do ponto e outros avisos (comunicado, pedidos, EPI).
// Marco 4K: o mesmo service worker guarda o app para abrir sem internet.
export const SW_FUNCIONARIO = "/sw.js?app=funcionario";
export function registrarAppOffline() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || window.location.protocol !== "https:") return;
  navigator.serviceWorker.register(SW_FUNCIONARIO, { scope: "/" }).catch(() => undefined);
}
type Acoes = { ler: () => Promise<AvisosEstado3u>; salvar: (e: string, p: string, a: string) => Promise<void>; apagar: (e: string) => Promise<void>;
  preferir: (lembrete: boolean, outros: boolean) => Promise<void>; testar: () => Promise<boolean> };
type Estado = "carregando" | "sem_suporte" | "iphone_instalar" | "negado" | "desligado" | "ligado";

export function AvisosFuncionario({ acoes, compacto = false }: { acoes: Acoes; compacto?: boolean }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [prefs, setPrefs] = useState({ lembrete: true, outros: true });
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { if (vivo) setEstado(ios && !instalado ? "iphone_instalar" : "sem_suporte"); return; }
      if (Notification.permission === "denied") { if (vivo) setEstado("negado"); return; }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) { if (vivo) setEstado("desligado"); return; }
      const atual = await acoes.ler();
      if (!vivo) return;
      setPrefs({ lembrete: atual.lembrete_ponto, outros: atual.outros_avisos });
      setEstado(atual.aparelhos > 0 ? "ligado" : "desligado");
    })().catch(() => { if (vivo) setEstado("sem_suporte"); });
    return () => { vivo = false; };
  }, [acoes]);

  async function ligar() {
    setOcupado(true); setMensagem("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setEstado(permissao === "denied" ? "negado" : "desligado"); return; }
      const reg = await navigator.serviceWorker.register(SW_FUNCIONARIO, { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveVapid(TESTE_ONLINE_VAPID_PUBLICA) });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("assinatura");
      try { await acoes.salvar(json.endpoint, json.keys.p256dh, json.keys.auth); } catch (e) { await sub.unsubscribe(); throw e; }
      const atual = await acoes.ler();
      setPrefs({ lembrete: atual.lembrete_ponto, outros: atual.outros_avisos });
      setEstado("ligado"); setMensagem("Avisos ligados neste celular.");
    } catch { setMensagem("Não foi possível ligar os avisos agora. Tente de novo com internet."); }
    finally { setOcupado(false); }
  }
  async function desligar() {
    setOcupado(true); setMensagem("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await acoes.apagar(sub.endpoint); await sub.unsubscribe(); }
      setEstado("desligado"); setMensagem("Avisos desligados neste celular.");
    } catch { setMensagem("Não foi possível desligar agora."); }
    finally { setOcupado(false); }
  }
  async function mudar(novo: { lembrete: boolean; outros: boolean }) {
    const antes = prefs; setPrefs(novo); setMensagem("");
    try { await acoes.preferir(novo.lembrete, novo.outros); setMensagem("Escolha salva."); }
    catch { setPrefs(antes); setMensagem("Não foi possível salvar agora. Tente com internet."); }
  }
  async function testar() {
    setOcupado(true); setMensagem("");
    try { setMensagem(await acoes.testar() ? "Aviso de teste enviado. Deve chegar em alguns segundos." : "Não foi possível enviar o teste agora."); }
    catch { setMensagem("Não foi possível enviar o teste agora."); }
    finally { setOcupado(false); }
  }

  const texto: Record<Estado, string> = {
    carregando: "Verificando este celular…",
    sem_suporte: "Este navegador não recebe avisos. Use o Chrome no Android, ou instale o app na tela de início.",
    iphone_instalar: "No iPhone: toque em Compartilhar › “Adicionar à Tela de Início”, abra o Metallo pelo ícone e volte aqui.",
    negado: "Os avisos estão bloqueados no navegador. Libere em Configurações › Notificações › Metallo.",
    desligado: "Receba no celular o lembrete na hora de bater o ponto e os avisos da empresa (comunicados, respostas dos seus pedidos, EPI para confirmar).",
    ligado: "Avisos ligados neste celular. Fora do horário de trabalho, só chega o lembrete do ponto.",
  };
  if (compacto && !["desligado", "iphone_instalar"].includes(estado) && !mensagem) return null;
  return <section className={styles.avisosCard} aria-label="Avisos no celular">
    <div className={styles.avisosTopo}><BellRing size={24} aria-hidden/><div><h2>Avisos no celular</h2><p>{texto[estado]}</p></div></div>
    {estado === "ligado" && !compacto && <div className={styles.avisosOpcoes}>
      <label><input type="checkbox" checked={prefs.lembrete} onChange={e => void mudar({ ...prefs, lembrete: e.target.checked })}/> Lembrete na hora do ponto</label>
      <label><input type="checkbox" checked={prefs.outros} onChange={e => void mudar({ ...prefs, outros: e.target.checked })}/> Comunicados, respostas de pedidos e EPI</label>
    </div>}
    {mensagem && <p className={styles.avisosMsg} role="status">{mensagem}</p>}
    <div className={styles.avisosBotoes}>
      {estado === "desligado" && <button type="button" className={styles.primary} onClick={() => void ligar()} disabled={ocupado}>{ocupado ? "Ligando…" : "Ligar avisos"}</button>}
      {estado === "ligado" && !compacto && <><button type="button" className={styles.queueButton} onClick={() => void testar()} disabled={ocupado}>Enviar um aviso de teste</button>
        <button type="button" className={styles.queueButton} onClick={() => void desligar()} disabled={ocupado}>Desligar avisos</button></>}
    </div>
  </section>;
}
