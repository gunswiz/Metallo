import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { EpiPreparacao3d } from "@/02_COMPONENTES_VISUAIS/epi-preparacao-3d";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getSupabaseEnv } from "@/09_CONFIGURACOES/ambienteSupabase";
import { recursosNovosLiberados } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { manageEpiFeedback3d, registerEpiDelivery3d } from "@/app/actions/epi-completo";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { ErrorPanel } from "@/02_COMPONENTES_VISUAIS/error-panel";

export default async function Page({searchParams}:{searchParams:Promise<{employee?:string;exchange?:string;prepared?:string;delivered?:string;feedback?:string}>}){
 const profile=await requireCapability("epi:write"); const query=await searchParams;
 const local=recursosNovosLiberados(getSupabaseEnv().url);
 const data=local?null:await (await getMetalloService()).siteSnapshot();
 const repo=local?await getEpiOperations():null;
 const employeeId=z.uuid().safeParse(query.employee).success?query.employee!:"";
 const exchangeId=z.uuid().safeParse(query.exchange).success?query.exchange!:"";
 const selection=new URLSearchParams();
 if(employeeId) selection.set("employee",employeeId);
 if(exchangeId) selection.set("exchange",exchangeId);
 const selectedHref=`/epis/entrega-em-lote${selection.size?`?${selection}`:""}`;
 const load=()=>repo?Promise.all([repo.choices(),repo.delivery3d(),employeeId?repo.kitSuggestion3d(employeeId):Promise.resolve([]),
   repo.awareness3i().catch(()=>null)]):Promise.resolve([null,null,[],null] as const);
 let loaded:Awaited<ReturnType<typeof load>>;
 try { loaded=await load(); }
 catch(error){
   unstable_rethrow(error);
   return <><PageHeader eyebrow="ENTREGA INDIVIDUAL" title="Nova entrega de EPI" description="Consulte os registros antes de continuar a preparação ou entrega."/>
     <section className="panel"><ErrorPanel title="Não foi possível conferir os dados de EPI" message="A consulta falhou ou retornou dados que o sistema não conseguiu validar. Tente carregar novamente. Se você acabou de enviar uma operação, confira o histórico antes de repeti-la."/>
       <div className="panel-body"><a className="button secondary" href={selectedHref}>Tentar carregar novamente</a><p>A seleção de funcionário e de troca foi mantida no endereço. Nenhum novo registro foi enviado por esta consulta.</p></div>
     </section></>;
 }
 const [choices, flow, suggestion, awareness]=loaded;
 const statusLabel:Record<string,string>={CONFIRMADO:"Recebimento confirmado pelo funcionário",DIVERGENCIA:"Divergência informada",EM_ANALISE:"Divergência em análise",RESOLVIDA:"Divergência resolvida; confirmação pendente",RECUSA:"Recusa registrada pela Gestão"};
 const employee=choices?.employees.find(entry=>entry.id===employeeId);
 const items=new Map(choices?.items.filter(entry=>entry.item_kind==="epi").map(entry=>[entry.id,entry])??[]);
 const batches=(choices?.batches??[]).filter(batch=>items.has(batch.item_id)).map(batch=>({id:batch.id,item_id:batch.item_id,name:items.get(batch.item_id)!.name,unit:items.get(batch.item_id)!.unit,quantity:batch.quantity,variant:batch.variant,ca_number:batch.ca_number}));
 return <><PageHeader eyebrow="ENTREGA INDIVIDUAL" title={local?"Nova entrega de EPI":"Entregar vários itens"} description={local?"Revise o kit, prepare os itens e registre a entrega física em etapas separadas.":"Monte a lista com lotes, C.A. e local; confirme todos os itens juntos."}/>
  {local&&choices&&flow&&<section className="panel" aria-labelledby="epi-3d-heading"><header className="panel-header"><div><h2 id="epi-3d-heading">Preparação e entrega de EPI · laboratório</h2><p>Kit sugerido, preparação e entrega são etapas separadas. SIMULAÇÃO SEM VALOR OFICIAL.</p></div></header>
    {(query.prepared||query.delivered||query.feedback)&&<div className="alert" role="status">Consulta atualizada. Confira a situação de cada kit e entrega abaixo.</div>}
    <div className="panel-body"><form method="get" className="form-grid"><label className="full">Funcionário para preparar kit<select name="employee" defaultValue={employeeId}><option value="">Selecione</option>{choices.employees.map(entry=><option key={entry.id} value={entry.id}>{entry.full_name}</option>)}</select></label><div className="form-actions"><button className="button secondary" type="submit">Consultar kit sugerido</button></div></form></div>
    {employee&&<EpiPreparacao3d actorId={profile.id} employeeId={employee.id} employeeName={employee.full_name} batches={batches} suggestion={suggestion}
      approved={flow.approved.filter(request=>request.employee_id===employee.id)} key={`${employee.id}:${query.exchange ?? ""}`} initialExchangeId={query.exchange} keyId={randomUUID()}/>}
    <div className="panel-body" id="kits-preparados"><h3>Kits preparados</h3><p>O kit abaixo está separado. Ele ainda não comprova entrega física nem aparece como entrega ao funcionário.</p>
      {flow.prepared.length===0?<p>Nenhum kit preparado no laboratório.</p>:<div className="list">{flow.prepared.map(prep=><article className="list-row" key={prep.preparation_id}>
        <div className="list-row-main"><strong>{prep.employee_name}</strong><span>Preparado em {new Date(prep.prepared_at).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}</span>
          <span>{prep.lines.map(line=>`${line.item_name} · ${line.quantity} ${line.unit}${line.variant?` · ${line.variant}`:""}`).join("; ")}</span>
          {prep.exchange_request_id&&<span>Vinculado à solicitação de troca {prep.exchange_request_id.slice(0,8)}</span>}
          <span>{prep.delivery_group_id?"Entrega registrada — confirmação do funcionário separada":"Kit preparado — entrega não registrada"}</span></div>
        {!prep.delivery_group_id&&<OperationForm action={registerEpiDelivery3d} label="Registrar entrega" pendingLabel="Registrando…" refreshOnComplete completionHref={`${selectedHref}#kits-preparados`}
          operationKeyScope={`metallo:3d:delivery:${profile.id}:${prep.preparation_id}`} initialOperationKey={randomUUID()} newOperationLabel={null}>
          <input type="hidden" name="preparationId" value={prep.preparation_id}/>
          <p className="full">Confira todos os itens do kit. Registre somente após a entrega física.</p>
          <label className="full"><input type="checkbox" name="confirmation" value="on" required/> Confirmo que estes itens foram entregues fisicamente.</label>
        </OperationForm>}</article>)}</div>}
    </div>
    <div className="panel-body" id="confirmacoes"><h3>Divergências e confirmações</h3>{flow.feedback.length===0?<p>Nenhuma entrega 3D registrada.</p>:<div className="list">{flow.feedback.map(entry=><article className="list-row" key={entry.group_id}>
      <div className="list-row-main"><strong>{entry.employee_name}</strong><span>Entregue em {new Date(entry.delivered_at).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}</span>
        <span>Manifestação: {entry.feedback_status?statusLabel[entry.feedback_status]??entry.feedback_status:"Confirmação pendente"}</span>
        {entry.item_name&&<span>Item: {entry.item_name}</span>}{entry.category&&<span>Categoria: {entry.category}</span>}{entry.details&&<span>Relato: {entry.details}</span>}
        {entry.public_message&&<span>Mensagem ao funcionário: {entry.public_message}</span>}{entry.internal_note&&<span>Nota interna: {entry.internal_note}</span>}</div>
      {(entry.feedback_status==="DIVERGENCIA"||entry.feedback_status==="EM_ANALISE")&&<OperationForm key={`${entry.group_id}:${entry.feedback_status}`} action={manageEpiFeedback3d} label="Registrar tratamento" refreshOnComplete completionHref={`/epis/entrega-em-lote?feedback=1${employeeId ? `&employee=${employeeId}` : ""}#confirmacoes`}
        operationKeyScope={`metallo:3d:feedback:${profile.id}:${entry.group_id}:${entry.feedback_status}`} initialOperationKey={randomUUID()} newOperationLabel="Iniciar outro tratamento">
        <input type="hidden" name="groupId" value={entry.group_id}/>
        <label>Ação<select name="action" defaultValue={entry.feedback_status==="DIVERGENCIA"?"EM_ANALISE":"RESOLVIDA"}><option value="EM_ANALISE">Colocar em análise</option><option value="RESOLVIDA">Registrar resolução</option></select></label>
        <label>Mensagem ao funcionário<textarea name="publicMessage" maxLength={240} rows={2}/></label><label>Nota interna da Gestão<textarea name="internalNote" maxLength={240} rows={2}/></label>
      </OperationForm>}
      {(entry.feedback_status===null||entry.feedback_status==="RESOLVIDA")&&<OperationForm action={manageEpiFeedback3d} label="Registrar recusa" refreshOnComplete completionHref={`${selectedHref}#confirmacoes`}
        operationKeyScope={`metallo:3d:refusal:${profile.id}:${entry.group_id}:${entry.feedback_status ?? "pendente"}`} initialOperationKey={randomUUID()} newOperationLabel={null}>
        <input type="hidden" name="groupId" value={entry.group_id}/><input type="hidden" name="action" value="RECUSA"/>
        <p className="full">Use só se o funcionário recusou receber ou confirmar este EPI. O registro não pode ser apagado; o funcionário verá a mensagem e ainda poderá confirmar depois.</p>
        <label className="full">O que foi recusado (o funcionário verá)<textarea name="publicMessage" maxLength={240} rows={2} required/></label>
        <label className="full">Testemunha / observação interna<textarea name="internalNote" maxLength={240} rows={2}/></label>
      </OperationForm>}</article>)}</div>}</div>
    <div className="panel-body"><h3>Termo de ciência dos deveres (NR-6, item 6.6.1)</h3>{awareness===null?<p>Consulta dos termos indisponível no momento.</p>:awareness.length===0?<p>Nenhum funcionário no seu escopo.</p>:<>
      <p>{awareness.filter(row=>row.accepted_at).length} de {awareness.length} funcionários aceitaram o termo no portal.</p>
      <div className="list">{awareness.map(row=><article className="list-row" key={row.employee_id}><div className="list-row-main"><strong>{row.employee_name}</strong>
        <span>{row.accepted_at?`Aceito em ${new Date(row.accepted_at).toLocaleString("pt-BR",{timeZone:"America/Fortaleza"})}`:"Pendente — o funcionário aceita em Meus EPIs no portal"}</span></div></article>)}</div></>}</div>
  </section>}
  {data&&<SiteOperations initial={data} profile={profile} mode="batch" initialEmployee={query.employee}/>}
 </>;
}
