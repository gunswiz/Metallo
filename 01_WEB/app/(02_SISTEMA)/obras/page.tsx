import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { SECAO_ANTIGA } from "@/09_CONFIGURACOES/navegacao-gestao";

// Marco 3K: "Obras e pedidos" foi dividida. Endereços antigos (?section=) levam à tela nova.
export default async function WorksPage({ searchParams }: { searchParams: Promise<{ section?: string; criada?: string }> }) {
  const { section, criada } = await searchParams;
  if (section && SECAO_ANTIGA[section] && section !== "works") redirect(SECAO_ANTIGA[section]);
  const profile = await requireCapability("inventory:read");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="OBRAS E RELATÓRIOS" title="Obras" description="Obras ativas e as equipes de cada uma. Uma obra pode reunir várias equipes com um estoque único."
      actions={can(profile, "admin:manage") ? <Link className="button primary" href="/obras/nova"><Plus size={16} />Nova obra</Link> : undefined}/>
    {criada && <div className="alert success" role="status">Obra “{criada.slice(0, 100)}” cadastrada. Ela já aparece no Estoque e no Lançar.</div>}
    <SubNav profile={profile} grupo="obras"/><SiteOperations initial={data} profile={profile} mode="works"/></>;
}
