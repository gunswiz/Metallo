import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
export default async function NewMovementPage({searchParams}:{searchParams:Promise<{item?:string;asset?:string;type?:string}>}){
 const profile=await requireCapability("operations:write"); const query=await searchParams;
 const data=await (await getMetalloService()).siteSnapshot();
 return <><PageHeader eyebrow="REGISTRO DE MOVIMENTAÇÃO" title="Nova movimentação" description="Materiais e equipamentos com saldo da obra, data do fato e fila local."/><SiteOperations initial={data} profile={profile} mode="movement" initialItem={query.item} initialAsset={query.asset} initialType={query.type}/></>;
}