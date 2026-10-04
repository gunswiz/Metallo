import Link from "next/link";
import { can } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

export default async function PedidosAdmPage() {
  const profile = await requireCapability("inventory:read");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="PEDIDOS" title="Pedidos à ADM" description="Compras de material e EPI pedidas pelas obras: andamento e recebimento."
    actions={can(profile, "requests:write") ? <Link className="button primary" href="/lancar/pedido">Novo pedido</Link> : undefined}/>
    <SubNav profile={profile} grupo="pedidos"/><SiteOperations initial={data} profile={profile} mode="orders"/></>;
}
