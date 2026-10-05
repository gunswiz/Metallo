"use client";

import { useEffect, useState } from "react";
import { Boxes, ChevronDown } from "lucide-react";
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

// Marco 3K: grupos recolhíveis. Toque no nome do grupo (ex.: Pessoas) para abrir ou fechar.
// O grupo da tela atual abre sozinho; a escolha fica guardada neste navegador.
const CHAVE_MENU = "metallo-menu-grupos";
function lerAbertos(): string[] {
  try { const value = JSON.parse(localStorage.getItem(CHAVE_MENU) ?? "[]"); return Array.isArray(value) ? value.filter(x => typeof x === "string") : []; }
  catch { return []; }
}
export function SidebarNav({ profile, onNavigate }: { profile: SessionProfile; onNavigate?: () => void }) {
  const pathname = usePathname();
  const grupos = gruposVisiveis(profile);
  const atual = grupos.find(grupo => grupo.label && grupo.itens.some(item => ativo(pathname, item.href)))?.id;
  const [guardados, setGuardados] = useState<string[] | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => setGuardados(lerAbertos()), 0); return () => window.clearTimeout(timer); }, []);
  const abertos = new Set([...(guardados ?? []), ...(atual ? [atual] : [])]);
  function alternar(id: string) {
    const next = abertos.has(id) ? [...abertos].filter(x => x !== id) : [...abertos, id];
    setGuardados(next);
    try { localStorage.setItem(CHAVE_MENU, JSON.stringify(next)); } catch { /* só conveniência */ }
  }
  return (
    <nav className="sidebar-nav" aria-label="Navegação principal">
      {grupos.map(grupo => {
        const aberto = !grupo.label || abertos.has(grupo.id);
        const GroupIcon = grupo.icone ? ICONES[grupo.icone] ?? Boxes : Boxes;
        const temAtual = grupo.id === atual;
        return <div className="sidebar-group" key={grupo.id}>
          {grupo.label && <button type="button" className={temAtual ? "sidebar-group-toggle current" : "sidebar-group-toggle"}
            aria-expanded={aberto} aria-controls={`menu-${grupo.id}`} onClick={() => alternar(grupo.id)}>
            <GroupIcon size={19} aria-hidden /><span>{grupo.label}</span><ChevronDown size={17} aria-hidden className="sidebar-chevron"/></button>}
          {aberto && <div className="sidebar-group-items" id={`menu-${grupo.id}`}>{grupo.itens.map(item => {
            const on = ativo(pathname, item.href);
            const Icon = ICONES[item.icone] ?? Boxes;
            return <Link key={item.href} href={item.href} className={on ? "active" : undefined} aria-current={on ? "page" : undefined} onClick={onNavigate}>
              <Icon size={19} aria-hidden /><span>{item.label}</span>
            </Link>;
          })}</div>}
        </div>;
      })}
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
