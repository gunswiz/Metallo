import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function EstoquePage() {
  const profile = await requireCapability("inventory:read");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="ESTOQUE" title="Estoque das obras" description="Quanto tem de cada material e EPI em cada obra ou local."/>
    <SubNav profile={profile} grupo="estoque"/><SiteOperations initial={data} profile={profile} mode="stock"/></>;
}
