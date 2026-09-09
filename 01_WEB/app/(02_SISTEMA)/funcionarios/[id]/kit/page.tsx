import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, itemKindLabel } from "@metallo/core";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { EmployeeKitForm } from "@/02_COMPONENTES_VISUAIS/kit-funcionario-form";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { getEpiOperations } from "@/05_ACESSO_A_DADOS/Repositorios/epi-operacoes-repository";
import { recommendedKit } from "@/03_FUNCOES_E_LOGICA/kitDoFuncionario";
export default async function KitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ success?: string }> }) {
  const profile = await requireCapability("epi:read");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const repo = await getEpiOperations();
  const [choices, kit] = await Promise.all([repo.choices(), repo.employeeKit(id)]);
  const employee = choices.employees.find((entry) => entry.id === id);
  if (!employee) notFound();
  const kitItems = [...choices.items];
  for (const line of kit.lines) if (line.epi_items && !kitItems.some((item) => item.id === line.item_id)) kitItems.push(line.epi_items);
  const defaults = recommendedKit(employee.profession);
  const required: Record<string, number> = kit.configured ? Object.fromEntries(kit.lines.map((line) => [line.item_id, line.required_quantity])) :
    Object.fromEntries(choices.items.flatMap((item) => { const qty = defaults.get((item.system_key ?? item.code).toUpperCase()); return qty ? [[item.id, qty]] : []; }));
  const current = new Map<string, number>();
  for (const row of kit.deliveries) current.set(row.item_id, (current.get(row.item_id) ?? 0) + row.quantity);
  const pending = new Set(kit.pending.map((row) => row.item_id));
  return <><PageHeader eyebrow="KIT DO FUNCIONÁRIO" title={employee.full_name} description={kit.configured ? "Kit individual configurado, como no aplicativo." : "Recomendação da profissão, como no aplicativo. Um administrador pode personalizá-la."} actions={<Link className="button ghost" href={`/funcionarios/${id}`}>Voltar ao perfil</Link>} />
    {query.success && <div className="alert success" role="status">Kit salvo.</div>}
    <section className="panel"><header className="panel-header"><h2>Itens previstos e faltantes</h2></header><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Tipo</th><th>Previsto</th><th>Em uso</th><th>Faltante</th><th>Ação</th></tr></thead><tbody>
      {kitItems.filter((item) => required[item.id]).map((item) => { const missing = Math.max(0, required[item.id] - (current.get(item.id) ?? 0)); return <tr key={item.id}><td>{item.name}{!item.active && " (inativo)"}</td><td>{itemKindLabel(item.item_kind)}</td><td>{required[item.id]}</td><td>{current.get(item.id) ?? 0}</td><td>{missing}</td><td>{!item.active ? "Remova do kit para atualizar a previsão" : pending.has(item.id) ? <Link href={`/epis/solicitacoes?employee=${id}`}>Solicitação pendente</Link> : missing > 0 && can(profile.role, "epi:write") ? <Link href={`/epis/solicitacoes?employee=${id}&item=${item.id}&quantity=${Math.min(missing, 100)}`}>Solicitar faltante</Link> : "Em dia"}</td></tr>; })}
    </tbody></table>{Object.keys(required).length === 0 && <p className="panel-body">Nenhum item previsto neste kit.</p>}</div></section>
    {can(profile.role, "admin:manage") && <section className="panel"><header className="panel-header"><h2>Personalizar kit</h2></header><div className="panel-body"><EmployeeKitForm employeeId={id} items={kitItems.map((item) => ({ ...item, name: item.active ? item.name : `${item.name} (inativo — remova do kit)` }))} initial={required} /></div></section>}
  </>;
}
