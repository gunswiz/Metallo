import Link from "next/link";
import { can, formatDateTime } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { PersonalItemDeliveryFields3g } from "@/02_COMPONENTES_VISUAIS/entrega-item-pessoal-3g";
import { requireCapability, requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { readAdminPersonalItems3g, readPersonalItemCatalog3g, readPersonalItemStock3g } from "@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g";
import { closePersonalItem3g, decidePersonalItem3g, deliverPersonalItem3g } from "@/app/actions/itens-pessoais-3g";

const statusLabel: Record<string, string> = {
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmação", EM_USO: "Em uso", DANIFICADO: "Problema: danificado",
  EXTRAVIADO: "Problema: extraviado", DEVOLVIDO: "Devolvido", SUBSTITUIDO: "Substituído",
};
const reasonLabel: Record<string, string> = { WEAR: "Desgaste", DAMAGED: "Dano", LOST: "Perda ou extravio", OTHER: "Outro" };
const stockOriginLabel: Record<string, string> = { LEGACY_PRE_INTEGRATION: "Legado sintético anterior à integração com estoque",
  STOCK_BATCH: "Saída do estoque registrada junto com a entrega", WITHOUT_STOCK: "Entrega sem vínculo com estoque" };
const exceptionReasonLabel: Record<string, string> = { EXTERNAL_SUPPLY: "Item fornecido externamente",
  UNTRACKED_LEGACY_STOCK: "Estoque legado não rastreado",
  AUTHORIZED_OPERATIONAL_ADJUSTMENT: "Ajuste operacional autorizado", OTHER: "Outro motivo" };
const returnDestinationLabel: Record<string, string> = { STOCK_REUSABLE: "Retornado reutilizável ao lote de origem",
  EVALUATION: "Devolvido para avaliação", DAMAGED: "Danificado", DISCARDED: "Descartado/inutilizado", OTHER: "Outro destino" };

export default async function EmployeePersonalItemsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ delivered?: string; decided?: string; closed?: string }>;
}) {
  await requireCapability("epi:write");
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const service = await getMetalloService();
  const [{ employee }, items, catalog, stock] = await Promise.all([
    service.getEmployee(id), readAdminPersonalItems3g({ employeeId: id }), readPersonalItemCatalog3g(), readPersonalItemStock3g(),
  ]);
  const current = items.filter(item => item.status !== "DEVOLVIDO" && item.status !== "SUBSTITUIDO");
  const history = items.filter(item => item.status === "DEVOLVIDO" || item.status === "SUBSTITUIDO");
  return <>
    <PageHeader eyebrow="MARCO 3G · LABORATÓRIO" title={`Itens pessoais de ${employee.full_name}`}
      description="Ferramentas pessoais não classificadas como EPI. Entrega, confirmação e encerramento são fatos separados."
      actions={<Link className="button secondary" href={`/funcionarios/${id}`}>Voltar ao funcionário</Link>} />
    {(query.delivered || query.decided || query.closed) && <div className="alert success" role="status">Registro realizado no laboratório. Confira o histórico abaixo.</div>}
    <section className="panel"><header className="panel-header"><div><h2>Entregar item pessoal</h2><p>A entrega aparece imediatamente para o funcionário como aguardando confirmação.</p></div></header>
      <div className="panel-body"><OperationForm action={deliverPersonalItem3g} label="Registrar entrega" pendingLabel="Registrando…"
        operationKeyScope={`metallo:3g:delivery:${profile.id}:${id}`} initialOperationKey={crypto.randomUUID()}>
        <input type="hidden" name="employeeId" value={id}/>
        <PersonalItemDeliveryFields3g catalog={catalog} batches={stock.filter(batch =>
          catalog.some(item => item.id === batch.item_id) && (batch.worksite_id !== null || profile.role === "admin"))}
          allowExceptional={profile.role === "admin"}/>
      </OperationForm>{can(profile, "admin:manage") && <p><Link href="/epis/novo?kind=personal_tool">Cadastrar novo tipo de item pessoal</Link></p>}
      </div></section>
    <section className="panel"><header className="panel-header"><div><h2>Itens atuais</h2><p>Uma nova entrega não encerra a anterior automaticamente.</p></div></header>
      {current.length === 0 ? <div className="panel-body">Nenhum item pessoal atual.</div> : <div className="panel-body list personal-items-current">{current.map(item => <article className="list-row personal-item-entry" key={item.delivery_id}>
        <div className="list-row-main personal-item-details"><strong>{item.item_name}</strong><span>{item.quantity} {item.unit} · {item.variant ?? "Sem variante"} · Entregue em {formatDateTime(item.delivered_at)}</span>
          <span>Situação: {statusLabel[item.status]} · Recebimento: {item.confirmed_at ? `confirmado em ${formatDateTime(item.confirmed_at)}` : "pendente"}</span>
          <span>Origem: {stockOriginLabel[item.stock_origin]}</span>
          {item.exception_reason && <span>Motivo da exceção: {exceptionReasonLabel[item.exception_reason]}
            {item.exception_acknowledged_at && ` · confirmada em ${formatDateTime(item.exception_acknowledged_at)}`}</span>}
          {item.internal_note && <span>Nota interna: {item.internal_note}</span>}
          {item.requests.map(request => <div key={request.request_id}>
            <span>{request.action === "PROBLEM" ? "Problema informado" : "Troca solicitada"} · {reasonLabel[request.reason] ?? request.reason} · {formatDateTime(request.requested_at)}</span>
            {request.note && <span> · {request.note}</span>}
            {request.decision && <span> · {request.decision === "EXCHANGE_APPROVED" ? "Aprovada; aguarda entrega separada" : "Recusada"}</span>}
            {request.action === "EXCHANGE_REQUESTED" && !request.decision && <OperationForm action={decidePersonalItem3g} label="Registrar decisão">
              <input type="hidden" name="employeeId" value={id}/><input type="hidden" name="requestId" value={request.request_id}/>
              <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/>
              <label>Decisão<select name="action" required defaultValue=""><option value="" disabled>Selecione</option><option value="EXCHANGE_APPROVED">Aprovar; não entrega automaticamente</option><option value="EXCHANGE_REFUSED">Recusar</option></select></label>
              <label>Nota opcional<input name="note" maxLength={240}/></label>
            </OperationForm>}
          </div>)}
        </div>
        <div className="personal-item-close"><OperationForm action={closePersonalItem3g} label="Registrar encerramento">
          <input type="hidden" name="employeeId" value={id}/><input type="hidden" name="deliveryId" value={item.delivery_id}/>
          <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/>
          <label>Ação<select name="action" required defaultValue=""><option value="" disabled>Selecione</option><option value="RETURNED">Devolução</option><option value="REPLACED">Substituição</option></select></label>
          <label>Nova entrega correspondente<select name="relatedDeliveryId" defaultValue=""><option value="">Nenhuma; usar para devolução</option>{items.filter(candidate => candidate.delivery_id !== item.delivery_id && candidate.item_id === item.item_id && candidate.delivered_at >= item.delivered_at).map(candidate => <option key={candidate.delivery_id} value={candidate.delivery_id}>{candidate.item_name} · {formatDateTime(candidate.delivered_at)}</option>)}</select></label>
          <label>Destino se devolução<select name="returnDestination" defaultValue=""><option value="">Não se aplica à substituição</option>
            {item.stock_origin === "STOCK_BATCH" && <option value="STOCK_REUSABLE">Retornou reutilizável ao lote de origem</option>}
            <option value="EVALUATION">Para avaliação, sem retorno ao saldo</option>
            <option value="DAMAGED">Danificado, sem retorno ao saldo</option>
            <option value="DISCARDED">Descartado/inutilizado</option>
            <option value="OTHER">Outro destino, sem retorno ao saldo</option>
          </select></label>
          <label>Nota opcional<input name="note" maxLength={240}/></label>
        </OperationForm></div>
      </article>)}</div>}
    </section>
    <section className="panel"><header className="panel-header"><h2>Histórico encerrado</h2></header><div className="panel-body list">
      {history.length === 0 ? <p>Nenhuma devolução ou substituição registrada.</p> : history.map(item => <div className="list-row" key={item.delivery_id}>
        <div className="list-row-main"><strong>{item.item_name}</strong><span>{item.quantity} {item.unit} · Entregue em {formatDateTime(item.delivered_at)}</span>
          <span>Origem: {stockOriginLabel[item.stock_origin]}</span>
          {item.exception_reason && <span>Motivo da exceção: {exceptionReasonLabel[item.exception_reason]}</span>}
          {item.return_destination && <span>Destino: {returnDestinationLabel[item.return_destination]}</span>}</div><span>{statusLabel[item.status]}</span>
      </div>)}
    </div></section>
  </>;
}
