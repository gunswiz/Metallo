import Link from "next/link";
import { EmptyState } from "@/02_COMPONENTES_VISUAIS/empty-state";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { Pagination } from "@/02_COMPONENTES_VISUAIS/pagination";
import { SearchToolbar } from "@/02_COMPONENTES_VISUAIS/search-toolbar";
import { StatusBadge } from "@/02_COMPONENTES_VISUAIS/status-badge";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { parsePage, type SearchParams } from "@/03_FUNCOES_E_LOGICA/lerFiltrosEPaginacao";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";
import { requireProfile } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { can } from "@metallo/core";
import { Plus } from "lucide-react";

function asoState(expiry: string | null) {
  if (!expiry) return { value: "maintenance", label: "ASO não informado" };
  const days = Math.ceil((new Date(`${expiry}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { value: "lost", label: "ASO vencido" };
  if (days <= 30) return { value: "maintenance", label: `Vence em ${days}d` };
  return { value: "available", label: "ASO regular" };
}

export default async function EmployeesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireCapability("epi:read");
  const profile = await requireProfile();
  const input = await parsePage(searchParams);
  const service = await getMetalloService();
  const result = await service.listEmployees(input);
  return (
    <>
      <PageHeader eyebrow="PESSOAS E SEGURANÇA" title="Funcionários" description="Função, equipe, fardamento, EPI, itens pessoais e validade do ASO." actions={can(profile, "admin:manage") ? <Link className="button primary" href="/funcionarios/novo"><Plus size={16} />Novo funcionário</Link> : undefined} />
      <section className="panel"><div className="panel-body"><SearchToolbar placeholder="Nome, matrícula ou profissão" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Função</th><th>Equipe</th><th>Tamanhos</th><th>ASO</th><th></th></tr></thead><tbody>{result.data.map((employee) => { const aso = asoState(employee.aso_expiry_date); return <tr key={employee.id}><td><span className="primary-cell">{employee.full_name}</span><span className="secondary-cell">{employee.registration_code ?? "Sem matrícula"}</span></td><td>{employee.profession}</td><td>{employee.teams?.name ?? "—"}</td><td>Farda {employee.shirt_size ?? "—"} · Bota {employee.shoe_size ?? "—"}</td><td><StatusBadge value={aso.value} label={aso.label} /></td><td><Link className="text-link" href={`/funcionarios/${employee.id}`}>Abrir perfil</Link></td></tr>; })}</tbody></table></div>}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
