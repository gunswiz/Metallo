import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchToolbar } from "@/components/search-toolbar";
import { StatusBadge } from "@/components/status-badge";
import { requireCapability } from "@/lib/auth/session";
import { parsePage, type SearchParams } from "@/lib/query";
import { getMetalloService } from "@/lib/services/metallo-service";
import { requireProfile } from "@/lib/auth/session";
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
      <PageHeader eyebrow="PESSOAS E SEGURANÇA" title="Funcionários" description="Função, equipe, fardamento, EPI, itens pessoais e validade do ASO." actions={can(profile.role, "admin:manage") ? <Link className="button primary" href="/funcionarios/novo"><Plus size={16} />Novo funcionário</Link> : undefined} />
      <section className="panel"><div className="panel-body"><SearchToolbar placeholder="Nome, matrícula ou profissão" q={input.q} /></div>
        {result.data.length === 0 ? <EmptyState /> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Funcionário</th><th>Função</th><th>Equipe</th><th>Tamanhos</th><th>ASO</th><th></th></tr></thead><tbody>{result.data.map((employee) => { const aso = asoState(employee.aso_expiry_date); return <tr key={employee.id}><td><span className="primary-cell">{employee.full_name}</span><span className="secondary-cell">{employee.registration_code ?? "Sem matrícula"}</span></td><td>{employee.profession}</td><td>{employee.teams?.name ?? "—"}</td><td>Farda {employee.shirt_size ?? "—"} · Bota {employee.shoe_size ?? "—"}</td><td><StatusBadge value={aso.value} label={aso.label} /></td><td><Link className="text-link" href={`/funcionarios/${employee.id}`}>Abrir perfil</Link></td></tr>; })}</tbody></table></div>}
        <Pagination {...result} q={input.q} />
      </section>
    </>
  );
}
