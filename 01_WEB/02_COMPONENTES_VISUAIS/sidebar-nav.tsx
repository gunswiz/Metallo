"use client";

import { Boxes } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { ativo, GRUPOS_MENU, type GrupoMenu, type ItemMenu } from "@/09_CONFIGURACOES/navegacao-gestao";

import { ICONES } from "./icones-menu";
export { ICONES };

export function itemVisivel(profile: SessionProfile, item: ItemMenu) {
  return can(profile, item.capability) && (!item.newFeature || recursosNovosLiberados(process.env.NEXT_PUBLIC_SUPABASE_URL));
}
export function gruposVisiveis(profile: SessionProfile): GrupoMenu[] {
  return GRUPOS_MENU.map(grupo => ({ ...grupo, itens: grupo.itens.filter(item => itemVisivel(profile, item)) }))
    .filter(grupo => grupo.itens.length > 0);
}

export function SidebarNav({ profile, onNavigate }: { profile: SessionProfile; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Navegação principal">
      {gruposVisiveis(profile).map(grupo => <div className="sidebar-group" key={grupo.id}>
        {grupo.label && <p className="sidebar-section-label">{grupo.label}</p>}
        {grupo.itens.map(item => {
          const on = ativo(pathname, item.href);
          const Icon = ICONES[item.icone] ?? Boxes;
          return <Link key={item.href} href={item.href} className={on ? "active" : undefined} aria-current={on ? "page" : undefined} onClick={onNavigate}>
            <Icon size={19} aria-hidden /><span>{item.label}</span>
          </Link>;
        })}
      </div>)}
    </nav>
  );
}

// Abas de um grupo (ex.: Pedidos à ADM · Pedidos dos funcionários · Máquinas alugadas) no topo das telas.
export function SubNav({ profile, grupo }: { profile: SessionProfile; grupo: string }) {
  const pathname = usePathname();
  const itens = gruposVisiveis(profile).find(entry => entry.id === grupo)?.itens ?? [];
  if (itens.length < 2) return null;
  return <nav className="module-tabs sub-nav" aria-label="Telas deste grupo">{itens.map(item =>
    <Link key={item.href} href={item.href} className={ativo(pathname, item.href) ? "active" : undefined}
      aria-current={ativo(pathname, item.href) ? "page" : undefined}>{item.label}</Link>)}</nav>;
}
