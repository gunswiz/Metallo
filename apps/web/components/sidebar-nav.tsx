"use client";

import {
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Gauge,
  Settings,
  ShieldCheck,
  Users,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Capability } from "@metallo/core";
import type { UserRole } from "@metallo/types";

const entries: Array<{
  href: string;
  label: string;
  icon: typeof Gauge;
  capability: Capability;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, capability: "dashboard:read" },
  { href: "/almoxarifado", label: "Almoxarifado", icon: Building2, capability: "inventory:read" },
  { href: "/equipes", label: "Equipes", icon: Users, capability: "inventory:read" },
  { href: "/funcionarios", label: "Funcionários", icon: ShieldCheck, capability: "epi:read" },
  { href: "/movimentacoes", label: "Movimentações", icon: ClipboardList, capability: "inventory:read" },
  { href: "/consumo", label: "Consumo", icon: ChartNoAxesCombined, capability: "inventory:read" },
  { href: "/relatorios", label: "Relatórios", icon: ChartNoAxesCombined, capability: "inventory:read" },
  { href: "/usuarios", label: "Usuários", icon: UserRoundCog, capability: "admin:manage" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, capability: "admin:manage" },
];

export function SidebarNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar-nav" aria-label="Navegação principal">
      {entries.filter((entry) => can(role, entry.capability)).map((entry) => {
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
