import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function LocacoesPage() {
  const profile = await requireCapability("inventory:read");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="PEDIDOS" title="Máquinas alugadas" description="Avise quando não precisar mais; a ADM combina a devolução e controla valores e datas."/>
    <SubNav profile={profile} grupo="pedidos"/><SiteOperations initial={data} profile={profile} mode="rentals"/></>;
}
