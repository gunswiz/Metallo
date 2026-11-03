import Link from "next/link";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { categoriasCnh10k } from "@/03_FUNCOES_E_LOGICA/Frota/condutores-10k";
import { lerCondutores10k, requireFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { salvarCnh10k } from "@/app/actions/condutores-10k";

const rotulo = { informado: "Aguardando conferência do engenheiro", conferido: "Documento conferido pelo engenheiro", invalidado: "Documento invalidado" };
const dia = (data: string) => data.split("-").reverse().join("/");

export default async function CondutoresPage({ searchParams }: { searchParams: Promise<{ funcionario?: string }> }) {
  const profile = await requireCapability("epi:write");
  requireFrota10a();
  if (profile.role !== "admin" && profile.role !== "engineer") notFound();
  const { funcionario } = await searchParams;
  if (funcionario && !z.uuid().safeParse(funcionario).success) notFound();
  const data = await lerCondutores10k(funcionario);
  const pessoa = data.funcionarios.find(e => e.id === funcionario);
  if (funcionario && !pessoa) notFound();
  const atual = data.historico[0];
  const revisao = atual?.revisao ?? 0;
  return <>
    <PageHeader eyebrow="FROTA · CONDUTORES" title="Documentos dos condutores" description="Cadastre a habilitação e acompanhe a conferência documental pelo engenheiro."/>
    <SubNav profile={profile} grupo="frota"/>
    <p className="alert" role="note">Esta etapa não autoriza dirigir nem operar Munck. Os requisitos por tipo de veículo e o bloqueio de saída por autorização ainda dependem da definição do engenheiro.</p>
    <form method="get" className="filter-row"><label>Funcionário<select name="funcionario" defaultValue={funcionario ?? ""} required><option value="" disabled>Selecione um funcionário</option>{data.funcionarios.map(e => <option key={e.id} value={e.id}>{e.nome}{e.ativo ? "" : " · Inativo"}</option>)}</select></label><button className="button" type="submit">Consultar</button></form>
    {!data.funcionarios.length && <p>Nenhum funcionário disponível no seu acesso.</p>}
    {pessoa && <>
      <section className="panel"><header className="panel-header"><h2>{pessoa.nome}</h2></header><div className="panel-body">
        <p><Link href={`/funcionarios/${pessoa.id}`}>Cadastro do funcionário</Link> · <Link href={`/treinamentos?funcionario=${pessoa.id}`}>Consultar treinamentos e ASO</Link></p>
        <p role="status">{atual ? `${rotulo[atual.situacao]} · CNH ${atual.categoria} · validade ${dia(atual.validade)}${atual.validade < data.hoje ? " · Data de validade vencida" : ""}` : "CNH ainda não cadastrada."}</p>
        {!pessoa.ativo ? <p>Funcionário inativo. Histórico disponível somente para consulta.</p> : <OperationForm key={`${pessoa.id}:${revisao}`} action={salvarCnh10k} label={atual ? "Registrar nova revisão" : "Registrar documento"}
          operationKeyScope={`metallo:frota:cnh:${profile.id}:${pessoa.id}:${revisao}`} initialOperationKey={randomUUID()} refreshOnComplete newOperationLabel={null}>
          <input type="hidden" name="employeeId" value={pessoa.id}/><input type="hidden" name="base" value={revisao}/>
          <label>Categoria da CNH<select name="categoria" defaultValue={atual?.categoria ?? ""} required><option value="" disabled>Selecione</option>{categoriasCnh10k.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Validade informada no documento<input type="date" name="validade" min="1900-01-01" max="2200-12-31" defaultValue={atual?.validade ?? ""} required/></label>
          <label>Situação documental<select name="situacao" defaultValue="informado"><option value="informado">Aguardando conferência</option>{profile.role === "engineer" && <option value="conferido">Conferido pelo engenheiro</option>}<option value="invalidado">Invalidado</option></select></label>
          <label>Referência interna do documento<input name="referencia" defaultValue={atual?.referencia ?? ""} minLength={3} maxLength={160} required placeholder="Ex.: pasta documental do funcionário"/></label>
          <p className="muted">Use uma referência interna para localizar o documento. Não informe CPF nem número completo da CNH. A conferência documental não substitui a autorização de condução.</p>
          <label className="full">Motivo da inclusão, conferência ou correção<textarea name="motivo" minLength={10} maxLength={600} rows={3} required/></label>
        </OperationForm>}
      </div></section>
      <section className="panel"><header className="panel-header"><h2>Histórico documental</h2></header><div className="panel-body">{data.historico.length ? <ul>{data.historico.map(h => <li key={h.id}><strong>Revisão {h.revisao} · {rotulo[h.situacao]}</strong><p>CNH {h.categoria} · validade {dia(h.validade)} · {h.referencia}</p><p>{h.autor} · {new Date(h.em).toLocaleString("pt-BR", {timeZone: "America/Fortaleza"})}<br/>{h.motivo}</p></li>)}</ul> : <p>Nenhum documento registrado.</p>}</div></section>
    </>}
  </>;
}
