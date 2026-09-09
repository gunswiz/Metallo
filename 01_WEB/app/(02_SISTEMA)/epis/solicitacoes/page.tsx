import Link from "next/link";
import { z } from "zod";
import { can, formatDateTime } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { Pagination } from "@/02_COMPONENTES_VISUAIS/pagination";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
import { RequestEpiForm } from "@/02_COMPONENTES_VISUAIS/solicitar-epi-form";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { compatibleRequestBatches } from "@/03_FUNCOES_E_LOGICA/kitDoFuncionario";
import { fulfillEpi } from "@/app/actions/epi-completo";
import { parsePage, type SearchParams } from "@/03_FUNCOES_E_LOGICA/lerFiltrosEPaginacao";

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireCapability("epi:read");
  const raw = await searchParams;
  const input = await parsePage(searchParams);
  const status = z.enum(["pending", "fulfilled", "cancelled", "all"]).catch("pending").parse(raw.status);
  const employee = z.uuid().safeParse(raw.employee);
  const employeeId = employee.success ? employee.data : undefined;
  const item = z.uuid().safeParse(raw.item);
  const quantity = z.coerce.number().int().min(1).max(100).catch(1).parse(raw.quantity);
  const repo = await getEpiOperations();
  const [result, choices] = await Promise.all([repo.requests(input.page, status, employeeId), repo.choices()]);
  const canWrite = can(profile.role, "epi:write");
  return <>
    <PageHeader eyebrow="COSEM" title="Solicitações de EPI e itens" description="Acompanhe pendências e entregue o tamanho solicitado a partir do estoque disponível." actions={<Link className="button ghost" href="/epis">Voltar aos EPIs</Link>} />
    {raw.success && <div className="alert success" role="status">Operação concluída. A lista foi atualizada.</div>}
    <section className="panel"><div className="panel-body"><form className="form-grid" method="get">
      <label>Situação<select name="status" defaultValue={status}><option value="pending">Pendentes</option><option value="fulfilled">Atendidas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option></select></label>
      <label>Funcionário<select name="employee" defaultValue={employeeId ?? ""}><option value="">Todos</option>{choices.employees.map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}</select></label>
      <div className="form-actions"><button className="button secondary">Filtrar</button></div>
    </form></div>
      {result.data.length === 0 ? <div className="panel-body"><p>Nenhuma solicitação neste filtro.</p></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário / equipe</th><th>Item</th><th>Quantidade / variante</th><th>Solicitação</th><th>Situação</th>{canWrite && <th>Atendimento</th>}</tr></thead><tbody>
        {result.data.map((request) => {
          const batches = compatibleRequestBatches(request, choices.batches);
          return <tr key={request.id}><td><Link href={`/funcionarios/${request.employee_id}`}>{request.epi_employees?.full_name}</Link><span className="secondary-cell">{request.teams?.name}</span></td><td>{request.epi_items?.name}</td><td>{request.quantity} {request.epi_items?.unit} · {request.requested_variant ?? "Qualquer variante"}</td><td>{formatDateTime(request.created_at)}</td><td><StatusBadge value={request.status} /></td>
            {canWrite && <td>{request.status !== "pending" ? "Concluída" : batches.length === 0 ? <span className="muted">Sem lote compatível com quantidade suficiente.</span> : <OperationForm action={fulfillEpi} label="Atender solicitação" pendingLabel="Entregando…"><input type="hidden" name="requestId" value={request.id} /><label className="full">Lote<select name="stockBatchId" required defaultValue=""><option value="">Selecione</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.variant ?? "Única"} · lote {batch.lot_number ?? batch.id.slice(0, 8)} · {batch.quantity} disponíveis</option>)}</select></label></OperationForm>}</td>}
          </tr>;
        })}
      </tbody></table></div>}
      <Pagination {...result} q="" extra={{ status, employee: employeeId ?? "" }} />
    </section>
    {canWrite && <section className="panel"><header className="panel-header"><h2>Nova solicitação</h2></header><div className="panel-body"><RequestEpiForm items={choices.items} employees={choices.employees} initialEmployee={employeeId} initialItem={item.success ? item.data : undefined} initialQuantity={quantity} /></div></section>}
  </>;
}
