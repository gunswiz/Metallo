import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { ConsumptionDashboard } from "@/02_COMPONENTES_VISUAIS/consumption-dashboard";
import { PageHeader } from "@/02_COMPONENTES_VISUAIS/page-header";
import { requireCapability } from "@/03_FUNCOES_E_LOGICA/Autenticacao/session";
import { analyzeConsumptionByUnit, analyzeConsumptionInReais, consumptionCategory, resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { can } from "@metallo/core";
import { lerPrecos3q, precosLiberados3q } from "@/05_ACESSO_A_DADOS/Supabase/precos-3q";
import { getMetalloService } from "@/04_SERVICOS/metallo-service";

type Query = { period?: string; from?: string; to?: string; team?: string; item?: string; category?: string };

function inputDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function ConsumptionPage({ searchParams }: { searchParams: Promise<Query> }) {
  const profile = await requireCapability("inventory:read");
  const query = await searchParams;
  const range = resolveConsumptionRange(query.period, query.from, query.to);
  const service = await getMetalloService();
  const [teams, materials] = await Promise.all([service.listTeams(), service.listMaterials({ page: 1, pageSize: 100, q: "" })]);
  const teamId = teams.some((team) => team.id === query.team) ? query.team : undefined;
  const itemId = materials.data.some((item) => item.id === query.item) ? query.item : undefined;
  const rows = await service.consumptionRows({ from: range.previousStart.toISOString(), to: range.currentEnd.toISOString(), teamId, itemId });
  const category = query.category?.slice(0, 80);
  const reports = analyzeConsumptionByUnit(rows, range, category);
  const categories = [...new Set(rows.map(consumptionCategory))].sort();
  // Marco 3Q: gasto em R$ (administrador e engenheiro; o banco devolve lista vazia para os demais).
  const precos = await lerPrecos3q();
  const reais = precos.length ? analyzeConsumptionInReais(rows, range, precos, category) : null;
  const podeEditarPrecos = precosLiberados3q() && can(profile, "admin:manage");

  const period = ["today", "7", "30", "month", "custom"].includes(query.period ?? "") ? query.period! : "30";
  // Marco 3K: período em botões (um toque); o resto fica em "Mais filtros".
  const link = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { period, team: teamId, item: itemId, category, from: query.from, to: query.to, ...changes };
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    if (merged.period !== "custom") { params.delete("from"); params.delete("to"); }
    return `/consumo?${params.toString()}`;
  };
  const periodos = [["today", "Hoje"], ["7", "7 dias"], ["30", "30 dias"], ["month", "Este mês"], ["custom", "Escolher datas"]] as const;
  const extras = Boolean(teamId || itemId || category || period === "custom");
  const resumo = [periodos.find(([id]) => id === period)?.[1], teams.find(team => team.id === teamId)?.name ?? "todas as equipes",
    materials.data.find(item => item.id === itemId)?.name, category].filter(Boolean).join(" · ");

  return <>
    <PageHeader eyebrow="OBRAS E RELATÓRIOS" title="Consumo" description="Quanto cada material foi usado. Caixas, unidades e outras medidas aparecem separadas."
      actions={<Link className="button primary" href="/lancar/consumo"><ArrowLeftRight size={16} />Registrar consumo</Link>} />
    <section className="panel consumo-filtros" aria-label="Filtros do consumo"><div className="panel-body">
      <nav className="chip-row" aria-label="Período">{periodos.map(([id, label]) =>
        <Link key={id} className={period === id ? "chip active" : "chip"} aria-current={period === id ? "true" : undefined} href={link({ period: id })}>{label}</Link>)}</nav>
      <p className="filtro-resumo">Mostrando: <strong>{resumo}</strong>{extras && <> · <Link href="/consumo">Limpar filtros</Link></>}</p>
      <details className="mais-filtros" open={extras || undefined}><summary>Mais filtros (equipe, material, categoria{period === "custom" ? ", datas" : ""})</summary>
        <form className="form-grid" method="get">
          <input type="hidden" name="period" value={period}/>
          {period === "custom" && <><label>De<input name="from" type="date" lang="pt-BR" defaultValue={query.from ?? inputDate(range.currentStart)} /></label>
          <label>Até<input name="to" type="date" lang="pt-BR" defaultValue={query.to ?? inputDate(new Date(range.currentEnd.getTime() - 86_400_000))} /></label></>}
          <label>Equipe<select name="team" defaultValue={teamId ?? ""}><option value="">Todas as equipes</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <label>Material<select name="item" defaultValue={itemId ?? ""}><option value="">Todos os materiais</option>{materials.data.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Categoria<select name="category" defaultValue={category ?? ""}><option value="">Todas as categorias</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
          <div className="form-actions"><button className="button primary" type="submit">Mostrar</button></div>
        </form>
      </details>
    </div></section>
    <ConsumptionDashboard reports={reports} periodLabel={range.label} reais={reais} podeEditarPrecos={podeEditarPrecos} />
  </>;
}
