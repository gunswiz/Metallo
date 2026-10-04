import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function ApoioPage() {
  const profile = await requireCapability("epi:read");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="PESSOAS" title="Funcionários em apoio" description="Quem está ajudando outra equipe ou obra, e até quando."/>
    <SubNav profile={profile} grupo="pessoas"/><SiteOperations initial={data} profile={profile} mode="people"/></>;
}
