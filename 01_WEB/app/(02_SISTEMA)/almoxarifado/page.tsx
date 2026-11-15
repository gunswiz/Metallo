import Link from "next/link";
import { Boxes, HardHat, PackageOpen, Wrench } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { can } from "@metallo/core";

const modules = [
  { href: "/materiais", title: "Materiais", description: "Estoque consumível por equipe", icon: PackageOpen, capability: "inventory:read" as const },
  { href: "/equipamentos", title: "Equipamentos", description: "Patrimônios e posse atual", icon: Wrench, capability: "inventory:read" as const },
  { href: "/ferramentas", title: "Ferramentas", description: "Itens pessoais distribuídos", icon: Boxes, capability: "epi:read" as const },
  { href: "/epis", title: "EPIs", description: "Proteção, fardamento, C.A. e variantes", icon: HardHat, capability: "epi:read" as const },
];

export default async function WarehousePage() {
  const profile = await requireProfile();
  const catalogs = modules.filter((module) => can(profile, module.capability));
  return (
    <>
      <PageHeader eyebrow="GESTÃO DE ESTOQUE" title="Almoxarifado" description="Consulte o saldo nas obras, acompanhe as movimentações e abra a ficha de cada item." />
      {can(profile, "inventory:read") && (
        <nav aria-label="Consultas de estoque" className="toolbar">
          <Link href="/estoque" className="button primary">Consultar estoque das obras</Link>
          <Link href="/movimentacoes" className="button">Ver histórico de movimentações</Link>
        </nav>
      )}
      <section aria-labelledby="catalogos-almoxarifado">
        <h2 id="catalogos-almoxarifado">Catálogos</h2>
        <div className="metric-grid">
          {catalogs.map(({ icon: Icon, href, title, description }) => (
            <Link className="metric-card" href={href} key={href}>
              <span className="metric-icon" aria-hidden="true"><Icon size={20} /></span>
              <strong className="metric-link-title">{title}</strong>
              <span>{description}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
