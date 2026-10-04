import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { lerCatalogoTreinamentos5a } from "@/05_ACESSO_A_DADOS/Supabase/treinamentos-5a";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { salvarExigencias5a, salvarTipoTreinamento5a } from "@/app/actions/treinamentos-5a";

// Marco 5A — administrador define os tipos (prazo de reciclagem) e o que cada função precisa ter.
export default async function TiposTreinamentoPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireCapability("admin:manage");
  if (!recursosNovosLiberados(getSupabaseEnv().url)) notFound();
  const query = await searchParams;
  const [catalogo, funcoes] = await Promise.all([lerCatalogoTreinamentos5a(), (await getMetalloService()).listProfessions()]);
  return <>
    <PageHeader eyebrow="PESSOAS E SEGURANÇA" title="Tipos e exigências" description="Quanto tempo vale cada treinamento e quais cada função precisa ter."
      actions={<Link className="button ghost" href="/treinamentos">← Treinamentos e ASO</Link>}/>
    {query.ok && <div className="alert success" role="status">Salvo.</div>}
    <p className="alert" role="note">Os prazos sugeridos (NR-35 2 anos, NR-33 1 ano, NR-10 2 anos) devem ser conferidos com o SESMT/engenheiro de segurança. “Sem vencimento” = sem prazo fixo; registre a reciclagem quando mudar função, equipamento ou procedimento.</p>
    <section className="panel"><header className="panel-header"><div><h2>O que cada função precisa ter</h2><p>Marque os treinamentos obrigatórios. Quem não tiver aparece como “Faltando”.</p></div></header>
      <div className="panel-body list">{funcoes.map(funcao => <article className="list-row" key={funcao.code}>
        <div className="list-row-main"><strong>{funcao.name}</strong></div>
        <OperationForm action={salvarExigencias5a} label="Salvar" pendingLabel="Salvando…">
          <input type="hidden" name="profession" value={funcao.code}/>
          <fieldset className="full check-grid">{catalogo.types.filter(tipo => tipo.active).map(tipo => <label key={tipo.code} className="check-line">
            <input type="checkbox" name="types" value={tipo.code} defaultChecked={catalogo.requirements.some(r => r.profession === funcao.code && r.type_code === tipo.code)}/>
            {tipo.nr ?? tipo.code} · {tipo.name}</label>)}</fieldset>
        </OperationForm>
      </article>)}</div></section>
    <section className="panel"><header className="panel-header"><div><h2>Tipos de treinamento</h2><p>Altere o nome ou o prazo de reciclagem. Desativar esconde o tipo dos novos registros.</p></div></header>
      <div className="panel-body list">{catalogo.types.map(tipo => <article className="list-row" key={tipo.code}>
        <div className="list-row-main"><strong>{tipo.nr ? `${tipo.nr} · ` : ""}{tipo.name}</strong><span>{tipo.validity_months ? `Vale ${tipo.validity_months} meses` : "Sem vencimento fixo"}{tipo.active ? "" : " · desativado"}</span></div>
        <OperationForm action={salvarTipoTreinamento5a} label="Salvar" pendingLabel="Salvando…">
          <input type="hidden" name="code" value={tipo.code}/>
          <label>Nome<input name="name" defaultValue={tipo.name} maxLength={80} required/></label>
          <label>NR<input name="nr" defaultValue={tipo.nr ?? ""} placeholder="NR-35" pattern="NR-[0-9]{2}"/></label>
          <label>Validade em meses (vazio = sem vencimento)<input name="validityMonths" type="number" min={1} max={120} defaultValue={tipo.validity_months ?? ""}/></label>
          <label className="check-line"><input type="checkbox" name="active" value="on" defaultChecked={tipo.active}/> Ativo</label>
        </OperationForm>
      </article>)}
      <article className="list-row"><div className="list-row-main"><strong>Novo tipo</strong><span>Ex.: NR-20, integração da obra, primeiros socorros.</span></div>
        <OperationForm action={salvarTipoTreinamento5a} label="Criar" pendingLabel="Criando…">
          <label>Código<input name="code" placeholder="NR20" maxLength={20} required pattern="[A-Za-z0-9_-]{2,20}"/></label>
          <label>Nome<input name="name" maxLength={80} required/></label>
          <label>NR<input name="nr" placeholder="NR-20" pattern="NR-[0-9]{2}"/></label>
          <label>Validade em meses (vazio = sem vencimento)<input name="validityMonths" type="number" min={1} max={120}/></label>
          <input type="hidden" name="active" value="on"/>
        </OperationForm></article></div></section>
  </>;
}
