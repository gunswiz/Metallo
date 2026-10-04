import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { ACOES_LANCAR } from "@/09_CONFIGURACOES/navegacao-gestao";

const modo = { consumo: "consumption", receber: "receiving", "entregar-epi": "delivery", pedido: "new-order",
  material: "material", equipamento: "equipment", "transferir-epi": "epi-transfer" } as const;

export default async function LancarAcaoPage({ params, searchParams }: { params: Promise<{ acao: string }>;
  searchParams: Promise<{ item?: string; asset?: string; employee?: string }> }) {
  const { acao } = await params;
  const definicao = ACOES_LANCAR.find(entry => entry.slug === acao);
  if (!definicao || !(acao in modo)) notFound();
  const profile = await requireProfile();
  if (!definicao.pode(profile)) redirect("/sem-permissao");
  const query = await searchParams;
  // No laboratório e no teste online, a entrega de EPI usa o fluxo com confirmação pelo app do Funcionário.
  if (acao === "entregar-epi" && recursosNovosLiberados(getSupabaseEnv().url))
    redirect(query.employee ? `/epis/entrega-em-lote?employee=${encodeURIComponent(query.employee)}` : "/epis/entrega-em-lote");
  const data = await (await getMetalloService()).siteSnapshot();
  return <><PageHeader eyebrow="LANÇAR" title={definicao.label} description={definicao.dica}
    actions={<Link className="button ghost" href="/lancar"><ArrowLeft size={16} aria-hidden/> Outras ações</Link>}/>
    <SiteOperations initial={data} profile={profile} mode={modo[acao as keyof typeof modo]} initialItem={query.item} initialAsset={query.asset} initialEmployee={query.employee}/></>;
}
