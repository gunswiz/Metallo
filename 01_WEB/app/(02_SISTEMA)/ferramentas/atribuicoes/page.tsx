import Link from "next/link";
import { formatDateTime } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { readAdminPersonalItems3g } from "@/05_ACESSO_A_DADOS/Supabase/itens-pessoais-3g";

const labels: Record<string, string> = { AGUARDANDO_CONFIRMACAO: "Aguardando confirmação", EM_USO: "Em uso",
  DANIFICADO: "Danificado", EXTRAVIADO: "Extraviado", DEVOLVIDO: "Devolvido", SUBSTITUIDO: "Substituído" };

export default async function PersonalAssignmentsPage({ searchParams }: { searchParams: Promise<{
  employee?: string; team?: string; work?: string; status?: string;
}> }) {
  await requireCapability("epi:write");
  const query = await searchParams;
  const all = await readAdminPersonalItems3g();
  const employees = [...new Map(all.map(item => [item.employee_id, item.employee_name])).entries()];
  const teams = [...new Map(all.filter(item => item.team_id).map(item => [item.team_id!, item.team_name!])).entries()];
  const works = [...new Map(all.filter(item => item.work_id).map(item => [item.work_id!, item.work_name!])).entries()];
  const rows = all.filter(item => (!query.employee || item.employee_id === query.employee)
    && (!query.team || item.team_id === query.team) && (!query.work || item.work_id === query.work)
    && (!query.status || item.status === query.status));
  return <>
    <PageHeader eyebrow="MARCO 3G · LABORATÓRIO" title="Quem está com quais itens?"
      description="Consulta das entregas pessoais. Equipamentos compartilhados continuam no almoxarifado."
      actions={<Link className="button secondary" href="/ferramentas">Voltar ao catálogo</Link>} />
    <section className="panel"><div className="panel-body"><form method="get" className="form-grid">
      <label>Funcionário<select name="employee" defaultValue={query.employee ?? ""}><option value="">Todos</option>{employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Equipe<select name="team" defaultValue={query.team ?? ""}><option value="">Todas</option>{teams.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Obra<select name="work" defaultValue={query.work ?? ""}><option value="">Todas</option>{works.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Situação<select name="status" defaultValue={query.status ?? ""}><option value="">Todas</option>{Object.entries(labels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <div className="form-actions"><button className="button primary" type="submit">Filtrar</button></div>
    </form></div>
    {rows.length === 0 ? <div className="panel-body">Nenhuma entrega pessoal neste filtro.</div> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Equipe / obra</th><th>Item</th><th>Entrega</th><th>Recebimento</th><th>Situação</th></tr></thead><tbody>
      {rows.map(item => <tr key={item.delivery_id}><td><Link href={`/funcionarios/${item.employee_id}/itens`}>{item.employee_name}</Link></td>
        <td>{item.team_name ?? "Sem equipe atribuída"} · {item.work_name ?? "Sem obra"}</td>
        <td>{item.item_name} · {item.quantity} {item.unit}</td><td>{formatDateTime(item.delivered_at)}</td>
        <td>{item.confirmed_at ? formatDateTime(item.confirmed_at) : "Pendente"}</td><td>{labels[item.status]}</td></tr>)}
    </tbody></table></div>}
    </section>
  </>;
}
