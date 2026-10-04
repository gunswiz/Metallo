import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
export default async function DeliveryPage({searchParams}:{searchParams:Promise<{employee?:string;item?:string;kind?:string}>}){
 const profile=await requireCapability("epi:write"); const query=await searchParams;
 // Laboratório e teste online: entrega de EPI só pelo fluxo com confirmação no app do Funcionário (digital ou senha).
 if(query.kind!=="personal_tool" && recursosNovosLiberados(getSupabaseEnv().url)) redirect(z.uuid().safeParse(query.employee).success ? `/epis/entrega-em-lote?employee=${query.employee}` : "/epis/entrega-em-lote");
 if(query.kind==="personal_tool") redirect(z.uuid().safeParse(query.employee).success ? `/funcionarios/${query.employee}/itens` : "/ferramentas/atribuicoes");
 const data=await (await getMetalloService()).siteSnapshot();
 return <><PageHeader eyebrow="ENTREGA INDIVIDUAL" title="Registrar entrega" description="Pessoa, equipe de trabalho, C.A. e local do lote." actions={<Link className="button secondary" href="/epis/entrega-em-lote">Entregar vários itens</Link>}/><SiteOperations initial={data} profile={profile} mode="delivery" initialEmployee={query.employee} initialItem={query.item}/></>;
}
