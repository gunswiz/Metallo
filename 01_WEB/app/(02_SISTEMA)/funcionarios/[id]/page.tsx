import Link from "next/link";
import { PackageCheck, Plus } from "lucide-react";
import { can, formatDateTime, itemKindLabel } from "@metallo/core";
import { closeEpiDelivery, updateEmployee } from "@/app/actions/operations";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";
import { requireCapability, requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

const uniformSizes = ["M", "G", "GG", "XG", "XXG"];
const shoeSizes = Array.from({ length: 9 }, (_, index) => String(index + 38));
function dateLabel(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada";
}

function AsoNotice({ expiry }: { expiry: string | null }) {
  if (!expiry) return <div className="alert warn" role="status"><strong>ASO sem validade informada.</strong> Edite o funcionário para programar a renovação.</div>;
  const today = new Date();
  const end = new Date(`${expiry}T23:59:59`);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return <div className="alert error" role="alert"><strong>ASO vencido em {dateLabel(expiry)}.</strong> Registre o novo exame e sua validade.</div>;
  if (days <= 30) return <div className="alert warn" role="status"><strong>ASO vence em {days} dia{days === 1 ? "" : "s"}.</strong> A renovação já pode ser preparada.</div>;
  return <div className="alert success" role="status"><strong>ASO em dia.</strong> Validade até {dateLabel(expiry)}.</div>;
}

export default async function EmployeeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string; delivered?: string; closed?: string }> }) {
  await requireCapability("epi:read");
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const service = await getMetalloService();
  const [{ employee, deliveries, requests }, teams, professions] = await Promise.all([service.getEmployee(id), service.listTeams(), service.listProfessions()]);
  const professionName = professions.find((profession) => profession.code === employee.profession)?.name ?? employee.profession;
  const activeDeliveries = deliveries.filter((delivery) => delivery.current_status === "active");
  const history = deliveries.filter((delivery) => delivery.current_status !== "active");
  const canWrite = can(profile.role, "epi:write");
  const canAdmin = can(profile.role, "admin:manage");

  return <>
    <PageHeader eyebrow="PERFIL DO FUNCIONÁRIO" title={employee.full_name} description={`${professionName} · ${employee.teams?.name ?? "Sem equipe"}`} actions={canWrite ? <>
      <Link className="button primary" href={`/epis/entrega?employee=${employee.id}&kind=personal_tool`}><PackageCheck size={16} />Adicionar item pessoal</Link>
      {canAdmin && <Link className="button secondary" href="/epis/novo?kind=personal_tool"><Plus size={16} />Cadastrar novo item</Link>}
    </> : undefined} />
    {query.updated && <div className="alert success" role="status">Funcionário e datas do ASO atualizados.</div>}
    {query.delivered && <div className="alert success" role="status">Entrega registrada e vinculada ao funcionário.</div>}
    {query.closed && <div className="alert success" role="status">Situação do item atualizada no histórico.</div>}
    {query.error && <div className="alert error" role="alert">Não foi possível salvar. Confira os campos e as datas informadas.</div>}
    <div className="module-tabs"><Link href={`/funcionarios/${employee.id}/kit`}>Kit e itens faltantes</Link><Link href={`/epis/solicitacoes?employee=${employee.id}`}>Solicitações</Link>{canWrite && <Link href={`/epis/entrega-em-lote?employee=${employee.id}`}>Entrega em lote</Link>}</div>
    <AsoNotice expiry={employee.aso_expiry_date} />
    <section className="detail-hero"><dl className="definition-grid">
      <div className="definition-item"><dt>Matrícula</dt><dd>{employee.registration_code ?? "Não informada"}</dd></div>
      <div className="definition-item"><dt>Fardamento</dt><dd>Camisa {employee.shirt_size ?? "—"} · Calça {employee.pants_size ?? "—"}</dd></div>
      <div className="definition-item"><dt>Bota</dt><dd>{employee.shoe_size ?? "—"}</dd></div>
      <div className="definition-item"><dt>Data do exame</dt><dd>{dateLabel(employee.aso_exam_date)}</dd></div>
      <div className="definition-item"><dt>Validade do ASO</dt><dd>{dateLabel(employee.aso_expiry_date)}</dd></div>
      <div className="definition-item"><dt>Situação</dt><dd><StatusBadge value={employee.active ? "active" : "retired"} /></dd></div>
    </dl></section>

    <section className="panel"><header className="panel-header"><div><h2>Itens atualmente atribuídos</h2><p>EPIs, fardamento e itens pessoais permanecem separados por tipo</p></div></header>
      {activeDeliveries.length === 0 ? <div className="panel-body"><p className="muted">Nenhum item ativo para este funcionário.</p></div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Tipo</th><th>Item</th><th>Entrega</th><th>Quantidade</th><th>Variante / C.A.</th><th>Situação</th>{canWrite && <th>Ação</th>}</tr></thead><tbody>{activeDeliveries.map((delivery) => <tr key={delivery.id}>
        <td>{itemKindLabel(delivery.epi_items?.item_kind)}</td><td><span className="primary-cell">{delivery.epi_items?.name}</span><span className="secondary-cell">{delivery.epi_items?.code}</span></td><td>{formatDateTime(delivery.delivered_at)}</td><td>{delivery.quantity} {delivery.epi_items?.unit}</td><td>{delivery.variant_snapshot ?? "—"} · {delivery.ca_snapshot ?? "sem C.A."}</td><td><StatusBadge value={delivery.current_status} /></td>
        {canWrite && <td><form action={closeEpiDelivery} className="inline-action"><input type="hidden" name="deliveryId" value={delivery.id} /><input type="hidden" name="employeeId" value={employee.id} /><label className="quantity-field">Qtd.<input name="quantity" type="number" min="1" max={delivery.quantity} defaultValue="1" required aria-label={`Quantidade de ${delivery.epi_items?.name} a atualizar, de ${delivery.quantity}`} title={`Escolha de 1 a ${delivery.quantity} ${delivery.epi_items?.unit}`} /></label><select name="status" aria-label={`Situação de ${delivery.epi_items?.name}`} defaultValue="returned"><option value="returned">Devolvido</option><option value="replaced">Substituído</option><option value="damaged">Danificado</option><option value="lost">Perdido</option><option value="consumed">Consumido</option></select><SubmitButton pendingLabel="Salvando…">Registrar</SubmitButton></form></td>}
      </tr>)}</tbody></table></div>}
    </section>

    <section className="content-grid">
      <div className="panel"><header className="panel-header"><div><h2>Histórico de itens</h2><p>Devoluções, substituições, perdas, danos e consumos</p></div></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Entrega</th><th>Quantidade</th><th>Variante</th><th>Situação</th></tr></thead><tbody>{history.map((delivery) => <tr key={delivery.id}><td><span className="primary-cell">{delivery.epi_items?.name}</span><span className="secondary-cell">{itemKindLabel(delivery.epi_items?.item_kind)}</span></td><td>{formatDateTime(delivery.delivered_at)}</td><td>{delivery.quantity} {delivery.epi_items?.unit}</td><td>{delivery.variant_snapshot ?? "—"}</td><td><StatusBadge value={delivery.current_status} /></td></tr>)}</tbody></table></div></div>
      <div className="panel"><header className="panel-header"><div><h2>Pendências</h2><p>Solicitações vinculadas à COSEM</p></div></header><div className="panel-body list">{requests.length === 0 ? <p className="muted">Sem pendências.</p> : requests.map((request) => <div className="list-row" key={request.id}><span className="list-row-main"><strong>{request.epi_items?.name}</strong><span>{request.requested_variant ?? "Sem variante"} · {formatDateTime(request.created_at)}</span></span><StatusBadge value={request.status} /></div>)}</div></div>
    </section>

    {canAdmin && <section className="panel" style={{ marginTop: 16 }}><header className="panel-header"><div><h2>Editar funcionário e ASO</h2><p>Datas são exibidas em português e armazenadas no banco como data ISO, sem conversão de fuso</p></div></header><div className="panel-body"><form action={updateEmployee} className="form-grid">
      <input type="hidden" name="employeeId" value={employee.id} />
      <label>Nome completo<input name="fullName" defaultValue={employee.full_name} required maxLength={140} /></label><label>Matrícula<input name="registrationCode" defaultValue={employee.registration_code ?? ""} maxLength={40} /></label>
      <label>Profissão<select name="profession" defaultValue={employee.profession} required>{professions.map((profession) => <option key={profession.code} value={profession.code}>{profession.name}</option>)}</select></label><label>Equipe<select name="teamId" defaultValue={employee.team_id} required>{teams.filter((team) => team.location_type === "field").map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>Camisa<select name="shirtSize" defaultValue={employee.shirt_size ?? ""}><option value="">Não informado</option>{uniformSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label>Calça<select name="pantsSize" defaultValue={employee.pants_size ?? ""}><option value="">Não informado</option>{uniformSizes.map((size) => <option key={size}>{size}</option>)}</select></label><label>Bota<select name="shoeSize" defaultValue={employee.shoe_size ?? ""}><option value="">Não informado</option>{shoeSizes.map((size) => <option key={size}>{size}</option>)}</select></label>
      <label>Data do exame ASO<input name="asoExamDate" type="date" lang="pt-BR" defaultValue={employee.aso_exam_date ?? ""} /></label><label>Validade do ASO<input name="asoExpiryDate" type="date" lang="pt-BR" defaultValue={employee.aso_expiry_date ?? ""} /></label>
      <label className="checkbox-field"><input name="active" type="checkbox" defaultChecked={employee.active} />Funcionário ativo</label>
      <div className="form-actions"><SubmitButton pendingLabel="Salvando…">Salvar funcionário</SubmitButton></div>
    </form></div></section>}
  </>;
}
