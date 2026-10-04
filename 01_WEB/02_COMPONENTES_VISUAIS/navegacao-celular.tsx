"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CirclePlus, Gauge, Inbox, Menu, X } from "lucide-react";
import type { SessionProfile } from "@metallo/types";
import { ativo, GRUPOS_MENU } from "@/09_CONFIGURACOES/navegacao-gestao";
import { SidebarNav } from "./sidebar-nav";

// Marco 3K: no celular a Gestão é para o rápido do dia a dia. Barra fixa embaixo com 4 botões grandes;
// "Menu" abre a lista completa (com Sair). No computador esta barra não aparece.
export function NavegacaoCelular({ profile, rodape }: { profile: SessionProfile; rodape: ReactNode }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const pedidos = GRUPOS_MENU.find(grupo => grupo.id === "pedidos")!.itens.some(item => ativo(pathname, item.href));
  useEffect(() => {
    if (!aberto) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", key); };
  }, [aberto]);
  const botao = (href: string, label: string, Icon: typeof Gauge, on: boolean) =>
    <Link href={href} className={on ? "active" : undefined} aria-current={on ? "page" : undefined} onClick={() => setAberto(false)}>
      <Icon size={24} aria-hidden /><span>{label}</span></Link>;
  return <>
    <nav className="bottom-nav" aria-label="Atalhos do celular">
      {botao("/dashboard", "Início", Gauge, !aberto && ativo(pathname, "/dashboard"))}
      {botao("/lancar", "Lançar", CirclePlus, !aberto && ativo(pathname, "/lancar"))}
      {botao("/pedidos-adm", "Pedidos", Inbox, !aberto && pedidos)}
      <button type="button" className={aberto ? "active" : undefined} aria-expanded={aberto} aria-controls="menu-celular"
        onClick={() => setAberto(value => !value)}>{aberto ? <X size={24} aria-hidden/> : <Menu size={24} aria-hidden/>}<span>Menu</span></button>
    </nav>
    {aberto && <div className="mobile-sheet" id="menu-celular" role="dialog" aria-modal="true" aria-label="Menu completo">
      <SidebarNav profile={profile} onNavigate={() => setAberto(false)}/>
      <div className="mobile-sheet-footer">{rodape}</div>
    </div>}
  </>;
}
