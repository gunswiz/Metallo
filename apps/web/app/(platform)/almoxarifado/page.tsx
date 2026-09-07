import Link from "next/link";
import { Boxes, HardHat, PackageOpen, Wrench } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireProfile } from "@/lib/auth/session";
import { can } from "@metallo/core";

const modules = [
  { href: "/materiais", title: "Materiais", description: "Estoque consumível por equipe", icon: PackageOpen, capability: "inventory:read" as const },
  { href: "/equipamentos", title: "Equipamentos", description: "Patrimônios e posse atual", icon: Wrench, capability: "inventory:read" as const },
  { href: "/ferramentas", title: "Ferramentas", description: "Itens pessoais distribuídos", icon: Boxes, capability: "epi:read" as const },
  { href: "/epis", title: "EPIs", description: "Proteção, fardamento, C.A. e variantes", icon: HardHat, capability: "epi:read" as const },
];

export default async function WarehousePage() {
  const profile = await requireProfile();
  return (
    <><PageHeader eyebrow="CENTRO DE CONTROLE" title="Almoxarifado" description="Ponto único para consultar e operar itens sem misturar seus controles." />
      <section className="metric-grid">{modules.filter((module) => can(profile.role, module.capability)).map(({ icon: Icon, ...module }) => <Link className="metric-card" href={module.href} key={module.href}><span className="metric-icon"><Icon size={18} /></span><strong style={{ fontSize: 17 }}>{module.title}</strong><span>{module.description}</span></Link>)}</section>
    </>
  );
}
