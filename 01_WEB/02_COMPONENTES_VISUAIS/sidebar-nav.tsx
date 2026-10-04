"use client";

import {
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Megaphone,
  Gauge,
  Settings,
  ShieldCheck,
  Users,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Capability } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import { LAB_SUPABASE_URL, recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";

const entries: Array<{
  href: string;
  label: string;
  icon: typeof Gauge;
  capability: Capability;
  localOnly?: boolean;
  // Recurso novo: laboratório e teste online, ainda fora da produção.
  newFeature?: boolean;
}> = [
  { href: "/dashboard", label: "Visão geral", icon: Gauge, capability: "dashboard:read" },
  { href: "/obras", label: "Obras e pedidos", icon: Building2, capability: "inventory:read" },
  { href: "/almoxarifado", label: "Almoxarifado", icon: Building2, capability: "inventory:read" },
  { href: "/equipes", label: "Equipes", icon: Users, capability: "inventory:read" },
  { href: "/funcionarios", label: "Funcionários", icon: ShieldCheck, capability: "epi:read" },
  { href: "/movimentacoes", label: "Movimentações", icon: ClipboardList, capability: "inventory:read" },
  { href: "/consumo", label: "Consumo", icon: ChartNoAxesCombined, capability: "inventory:read" },
  { href: "/relatorios", label: "Relatórios", icon: ChartNoAxesCombined, capability: "inventory:read" },
  { href: "/comunicados", label: "Comunicados", icon: Megaphone, capability: "admin:manage", newFeature: true },
  { href: "/ponto-laboratorio", label: "Ponto (teste)", icon: Clock3, capability: "admin:manage", newFeature: true },
  { href: "/usuarios", label: "Usuários", icon: UserRoundCog, capability: "admin:manage" },
  { href: "/minha-conta", label: "Minha conta", icon: UserRoundCog, capability: "dashboard:read" },
  { href: "/ajuda", label: "Guia de uso", icon: ClipboardList, capability: "dashboard:read" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, capability: "admin:manage" },
];

export function SidebarNav({ profile }: { profile: SessionProfile }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Navegação principal">
      {entries.filter((entry) => can(profile, entry.capability) &&
        (!entry.localOnly || process.env.NEXT_PUBLIC_SUPABASE_URL === LAB_SUPABASE_URL) &&
        (!entry.newFeature || recursosNovosLiberados(process.env.NEXT_PUBLIC_SUPABASE_URL))).map((entry) => {
        const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
        const Icon = entry.icon;
        return (
          <Link key={entry.href} href={entry.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            <Icon size={19} aria-hidden />
            <span>{entry.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
