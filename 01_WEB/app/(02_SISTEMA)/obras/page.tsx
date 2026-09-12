import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { createClient } from "@/05_ACESSO_A_DADOS/Supabase/server";
import { siteSnapshotSchema } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
export default async function WorksPage({searchParams}:{searchParams:Promise<{section?:string}>}) {
  const profile=await requireProfile(); const result=await (await createClient()).rpc('site_dashboard');
  if(result.error)throw new Error('Não foi possível carregar as obras e os pedidos.');
  const section=(await searchParams).section;
  return <><PageHeader eyebrow="ROTINA DA OBRA" title="Obras e pedidos" description="Estoque, consumo, compras, EPI, equipes de apoio e locações."/><SiteOperations initial={siteSnapshotSchema.parse(result.data)} profile={profile} initialSection={section&&['stock','orders','rentals','people','works','alerts'].includes(section)?section:'stock'}/></>;
}
