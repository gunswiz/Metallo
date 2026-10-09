"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { Home, CalendarDays, Clock3, FileText, Download, PackageCheck, Toolbox, RotateCcw, UsersRound, HardHat, Megaphone, ClipboardList, GraduationCap, CircleUserRound, ShieldCheck, LogOut, X } from "lucide-react";
import { BrandLogo } from "@/02_COMPONENTES_VISUAIS/brand";
import type { PortalScreen } from "@/03_FUNCOES_E_LOGICA/Autenticacao/use-colaborador-session";
import type { PersonalProfile } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";
import styles from "./colaborador.module.css";

type Item = { screen: PortalScreen; label: string; icon: typeof Home; hash?: string; note?: string };
const groups: { label: string; items: Item[] }[] = [
  { label: "Meu Ponto", items: [
    { screen: "ponto", label: "Registrar ponto", icon: Clock3 },
    { screen: "registros", label: "Meus registros", icon: FileText },
    { screen: "espelho", label: "Meu espelho do mês", icon: CalendarDays },
    { screen: "comprovantes", label: "Comprovantes", icon: Download },
  ] },
  { label: "EPI e Itens", items: [
    { screen: "epis", label: "Meus EPIs", icon: PackageCheck },
    { screen: "itens", label: "Meus itens pessoais", icon: Toolbox },
    { screen: "epis", hash: "epi-troca-heading", label: "Solicitar troca de EPI", icon: RotateCcw },
    { screen: "treinamentos", label: "Treinamentos e exames", icon: GraduationCap },
  ] },
  { label: "Trabalho", items: [
    { screen: "equipe", label: "Minha equipe", icon: UsersRound },
    { screen: "obra", label: "Minha obra", icon: HardHat },
    { screen: "comunicados", label: "Comunicados", icon: Megaphone },
  ] },
  { label: "Solicitações", items: [
    { screen: "epis", hash: "epi-solicitacoes", label: "Minhas solicitações", note: "Solicitações de EPI", icon: ClipboardList },
  ] },
  { label: "Minha Conta", items: [
    { screen: "perfil", label: "Meu perfil", icon: CircleUserRound },
    { screen: "perfil", hash: "perfil-seguranca", label: "Segurança", icon: ShieldCheck },
  ] },
];

export function DrawerColaborador({ open, onClose, trigger, profile, current, busy, logout, demo, go }: {
  open: boolean; onClose: () => void; trigger: RefObject<HTMLButtonElement | null>;
  profile: PersonalProfile; current: PortalScreen; busy: boolean;
  logout: () => Promise<void>; demo: boolean; go: (screen: PortalScreen) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // As seções pessoais podem surgir depois do carregamento autenticado.
    // Navegação por fragmento não deve criar outra tela ou outro fluxo.
    const allowed = new Set(["meus-registros", "comprovantes", "epi-troca-heading", "epi-solicitacoes", "epi-recebimento-heading", "perfil-seguranca"]);
    let observer: MutationObserver | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => { observer?.disconnect(); clearTimeout(timer); };
    const navigateSection = () => {
      stop(); const id = window.location.hash.slice(1);
      if (!allowed.has(id)) return;
      const locate = () => {
        const target = document.getElementById(id);
        if (!target) return false;
        target.setAttribute("tabindex", "-1"); target.scrollIntoView({ block: "start" }); target.focus({ preventScroll: true }); stop(); return true;
      };
      if (locate()) return;
      observer = new MutationObserver(locate); observer.observe(document.body, { childList: true, subtree: true });
      timer = setTimeout(stop, 10000);
    };
    navigateSection(); window.addEventListener("hashchange", navigateSection);
    return () => { stop(); window.removeEventListener("hashchange", navigateSection); };
  }, [current, profile.employee_id]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (!element) return;
    const originalOverflow = document.body.style.overflow;
    const returnTarget = trigger.current;
    document.body.style.overflow = "hidden";
    element.showModal();
    close.current?.focus();
    return () => { element.close(); document.body.style.overflow = originalOverflow; returnTarget?.focus(); };
  }, [open, trigger]);
  if (!open) return null;
  const itemLink = (item: Item) => <Link key={`${item.screen}-${item.hash ?? ""}`} href={`/colaborador/${item.screen}${item.hash ? `#${item.hash}` : ""}`}
    aria-current={current === item.screen && !item.hash ? "page" : undefined}
    className={current === item.screen && !item.hash ? styles.drawerActive : styles.drawerLink}
    onClick={event => { onClose(); if (demo) { event.preventDefault(); go(item.screen); } }}>
    <item.icon size={20} aria-hidden="true"/><span>{item.label}{item.note && <> <small>{item.note}</small></>}</span>
  </Link>;
  return <dialog id="colaborador-menu" ref={dialog} className={styles.drawer} aria-label="Menu do Metallo Funcionário"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target !== dialog.current) return; const rect = dialog.current.getBoundingClientRect(); if (event.clientX > rect.right || event.clientX < rect.left || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); }}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
    <div className={styles.drawerHeader}><BrandLogo/><button ref={close} type="button" className={styles.menuToggle} aria-label="Fechar menu" onClick={onClose}><X size={24}/></button></div>
    <div className={styles.drawerIdentity}><strong>{profile.full_name}</strong><span>Funcionário</span><small>{profile.team_name?.trim() || "Sem equipe atribuída"}</small></div>
    <nav aria-label="Navegação principal">
      {itemLink({ screen: "inicio", label: "Início", icon: Home })}
      {groups.map(group => <section key={group.label} aria-label={group.label} className={styles.drawerGroup}><h2>{group.label}</h2>{group.items.filter(item => !demo || !["ponto", "registros", "espelho", "comprovantes"].includes(item.screen)).map(itemLink)}</section>)}
    </nav>
    <button type="button" className={styles.drawerExit} disabled={busy} onClick={() => { onClose(); void logout(); }}><LogOut size={20} aria-hidden="true"/>Sair</button>
    <small className={styles.drawerDisclaimer}>SIMULAÇÃO SEM VALOR OFICIAL</small>
  </dialog>;
}
