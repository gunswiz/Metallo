import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { ConsumptionRow } from "@/05_ACESSO_A_DADOS/Repositorios/metallo-repository";

// Marco 3L: Consumo com gráficos, Funcionários em apoio e Comunicados com prévia.
vi.mock("next/navigation", () => ({ usePathname: () => "/consumo", useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/client", () => ({ createClient: () => ({ rpc: vi.fn(), auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/app/actions/comunicados-3h", () => ({ saveCommunication3h: vi.fn() }));
import { analyzeConsumptionByUnit, resolveConsumptionRange } from "@/03_FUNCOES_E_LOGICA/calcularConsumo";
import { ConsumptionDashboard } from "@/02_COMPONENTES_VISUAIS/consumption-dashboard";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { CommunicationForm3h } from "@/app/(02_SISTEMA)/comunicados/communication-form";

const agora = new Date("2026-10-05T12:00:00-03:00");
const disco = { id: "i1", name: "Disco de corte", code: "MAT-1", unit: "un", category: "Abrasivos" };
const lixa = { id: "i2", name: "Lixa flap", code: "MAT-2", unit: "un", category: "Abrasivos" };
const arame = { id: "i3", name: "Arame MIG", code: "MAT-3", unit: "kg", category: "Solda" };
const linha = (item: typeof disco, dias: number, quantity: number, equipe = "Equipe Solda A"): ConsumptionRow => ({
  id: crypto.randomUUID(), item_id: item.id, origin_team_id: equipe, quantity, note: null,
  created_at: new Date(agora.getTime() - dias * 86_400_000).toISOString(), items: item, origin: { id: equipe, name: equipe } });
const linhas = [linha(disco, 1, 8), linha(disco, 2, 4, "Equipe Montagem B"), linha(lixa, 3, 3), linha(arame, 1, 10),
  linha(disco, 35, 6), linha(lixa, 40, 1)];

beforeEach(() => { localStorage.clear(); });
afterEach(cleanup);

it("cálculo: uma barra por dia em 30 dias, por semana em períodos longos, e período anterior por material", () => {
  const range = resolveConsumptionRange("30", undefined, undefined, agora);
  const unidades = analyzeConsumptionByUnit(linhas, range);
  const un = unidades.find(entry => entry.unit === "un")!;
  expect(un.daily.bucket).toBe("dia");
  expect(un.daily.points).toHaveLength(30);
  expect(un.daily.points.reduce((soma, ponto) => soma + ponto.value, 0)).toBe(15);
  expect(un.materials.find(m => m.label === "Disco de corte")).toMatchObject({ value: 12, previous: 6, category: "Abrasivos" });
  expect(un.activeDays).toBe(3);
  const custom = resolveConsumptionRange("custom", "2026-07-01", "2026-09-30", agora);
  expect(analyzeConsumptionByUnit(linhas, custom)[0].daily.bucket).toBe("semana");
});

it("painel: números grandes, gráfico por dia, rosca, equipes e ranking com variação; kg não se mistura com unidades", () => {
  const range = resolveConsumptionRange("30", undefined, undefined, agora);
  render(<ConsumptionDashboard reports={analyzeConsumptionByUnit(linhas, range)} periodLabel={range.label}/>);
  const resumo = screen.getByRole("region", { name: "Resumo em unidades" });
  expect(within(resumo).getByText("Equipe que mais consumiu")).toBeInTheDocument();
  expect(within(resumo).getByText("Equipe Solda A")).toBeInTheDocument();
  expect(within(resumo).getByText("Disco de corte")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Consumo dia a dia" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Divisão do consumo por material, total 15 unidades/ })).toBeInTheDocument();
  const ranking = within(screen.getAllByRole("table")[0]);
  const linhaDisco = ranking.getByText("Disco de corte").closest("tr")!;
  expect(within(linhaDisco).getByText("+100%")).toBeInTheDocument();
  // Hover/foco numa barra mostra o valor do dia.
  fireEvent.focus(screen.getAllByRole("listitem", { name: /: 8 unidades$/ })[0]);
  expect(screen.getByRole("status")).toHaveTextContent("8 unidades");
  // Trocar a medida: kg tem seu próprio painel.
  fireEvent.click(screen.getByRole("button", { name: /kg/ }));
  expect(screen.getByRole("region", { name: "Resumo em kg" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /total 10 kg/ })).toBeInTheDocument();
});

it("painel vazio convida a registrar consumo", () => {
  const range = resolveConsumptionRange("today", undefined, undefined, agora);
  render(<ConsumptionDashboard reports={analyzeConsumptionByUnit([], range)} periodLabel={range.label}/>);
  expect(screen.getByText("Nenhum consumo neste período")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Registrar consumo" })).toHaveAttribute("href", "/lancar/consumo");
});

const admin = { id: "a0000000-0000-4000-8000-000000000001", fullName: "Gestor", role: "admin", active: true, teamId: null, operationPermissions: [], operationTeamIds: null } as unknown as SessionProfile;
const snapshot = (assignments: unknown[]) => ({ works: [], teams: [{ id: "t1", name: "Equipe Solda A", worksite_id: null, central: false }, { id: "t2", name: "Equipe Montagem B", worksite_id: null, central: false }],
  materials: [], epi_items: [], batches: [], assets: [], orders: [], rental_returns: [], rental_details: [], alerts: [],
  employees: [{ id: "e1", name: "Pedro Teste", team_id: assignments.length ? "t2" : "t1", home_team_id: "t1" }, { id: "e2", name: "Ana Teste", team_id: "t2", home_team_id: "t2" }],
  assignments }) as unknown as SiteSnapshot;

it("Funcionários em apoio mostra só quem está de fato ajudando outra equipe; a lista completa fica recolhida", () => {
  render(<SiteOperations initial={snapshot([{ id: "as1", employee_id: "e1", team_id: "t2", starts_at: "2026-10-01T12:00:00Z", ends_at: "2099-10-20T12:00:00Z", note: null }])} profile={admin} mode="people"/>);
  expect(screen.getByRole("heading", { name: "Em apoio agora (1)" })).toBeInTheDocument();
  const tabela = within(screen.getAllByRole("table")[0]);
  expect(tabela.getByText("Pedro Teste")).toBeInTheDocument();
  expect(tabela.queryByText("Ana Teste")).not.toBeInTheDocument();
  expect(tabela.getByRole("link", { name: "Ficha" })).toHaveAttribute("href", "/funcionarios/e1");
  expect(screen.getByText(/Ver todos os funcionários e onde estão \(2\)/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Abrir funcionário \/ PDF/ })).not.toBeInTheDocument();
});

it("Funcionários em apoio sem ninguém em apoio avisa em uma linha", () => {
  render(<SiteOperations initial={snapshot([])} profile={admin} mode="people"/>);
  expect(screen.getByRole("heading", { name: "Em apoio agora (0)" })).toBeInTheDocument();
  expect(screen.getByText("Ninguém está ajudando outra equipe agora.")).toBeInTheDocument();
});

it("Comunicados: prévia mostra como o funcionário vê, e 'Fixar no topo' é uma caixa marcável", () => {
  render(<CommunicationForm3h teams={[{ id: "t1", name: "Equipe Solda A" }]} works={[]} idempotencyKey="11111111-1111-4111-8111-111111111111"/>);
  const previa = within(screen.getByRole("complementary", { name: /Prévia de como o funcionário vê no app/ }));
  expect(previa.getByText("Título do comunicado")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Título/), { target: { value: "Reunião de segurança" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Fixar no topo/ }));
  fireEvent.change(screen.getByLabelText(/Público/), { target: { value: "TEAM" } });
  fireEvent.change(screen.getByLabelText(/^Equipe/), { target: { value: "t1" } });
  expect(previa.getByText("Reunião de segurança")).toBeInTheDocument();
  expect(previa.getByText("Fixado")).toBeInTheDocument();
  expect(previa.getByText(/Para: Equipe Solda A/)).toBeInTheDocument();
});
