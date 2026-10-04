import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";

// Marco 3K: Gestão reorganizada — menu em grupos, Lançar com ações curtas, barra inferior no celular.
const nav = vi.hoisted(() => ({ path: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/client", () => ({ createClient: () => ({ rpc: vi.fn(), auth: { getUser: async () => ({ data: { user: null } }) } }) }));
import { gruposVisiveis, SubNav } from "@/02_COMPONENTES_VISUAIS/sidebar-nav";
import { NavegacaoCelular } from "@/02_COMPONENTES_VISUAIS/navegacao-celular";
import { SiteOperations } from "@/02_COMPONENTES_VISUAIS/obras-pedidos";
import { ACOES_LANCAR, SECAO_ANTIGA } from "@/09_CONFIGURACOES/navegacao-gestao";
import { LAB_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";

const id = "a0000000-0000-4000-8000-000000000001";
const consulta: SessionProfile = { id, fullName: "Consulta Teste", role: "collaborator", active: true, teamId: "team", operationPermissions: [], operationTeamIds: null } as SessionProfile;
const almoxarife: SessionProfile = { ...consulta, fullName: "Almoxarife Teste", operationPermissions: ["consumption:write"] } as SessionProfile;
const admin: SessionProfile = { ...consulta, fullName: "Gestor Teste", role: "admin" } as SessionProfile;
const data: SiteSnapshot = { works: [{ id: "w1", name: "Obra Norte", stock_team_id: "team", active: true }],
  teams: [{ id: "team", name: "Equipe Teste", worksite_id: "w1", central: false }, { id: "team2", name: "Equipe Sul", worksite_id: null, central: false }],
  materials: [{ id: "m1", name: "Disco de corte", code: "MAT-1", unit: "un", stock: [{ team_id: "team", quantity: 10 }, { team_id: "team2", quantity: 0 }] },
    { id: "m2", name: "Eletrodo", code: "MAT-2", unit: "kg", stock: [{ team_id: "team", quantity: 4 }] }],
  epi_items: [], batches: [], employees: [], assignments: [], assets: [],
  orders: [{ id: "o1aaaaaa-0000-4000-8000-000000000000", team_id: "team", status: "received", note: null, occurred_at: "2026-10-01T12:00:00Z", created_at: "2026-10-01T12:00:00Z", lines: [], events: [] }],
  rental_returns: [], rental_details: [], alerts: [] } as unknown as SiteSnapshot;
beforeEach(() => { nav.path = "/dashboard"; localStorage.clear();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: async (_: string, callback: () => void) => callback() } }); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

it("menu em grupos mostra só o que o acesso permite", () => {
  const labels = (profile: SessionProfile) => gruposVisiveis(profile).flatMap(grupo => grupo.itens.map(item => item.label));
  expect(labels(consulta)).toContain("Estoque das obras");
  expect(labels(consulta)).not.toContain("Usuários");
  expect(labels(consulta)).not.toContain("Funcionários");
  expect(labels(admin)).toEqual(expect.arrayContaining(["Usuários", "Funcionários", "Pedidos à ADM", "Máquinas alugadas", "Obras"]));
  expect(labels(admin)).not.toContain("Obras e pedidos");
});

it("recursos novos (Pedidos dos funcionários, Comunicados) só aparecem fora da produção", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://producao.supabase.co");
  expect(gruposVisiveis(admin).flatMap(grupo => grupo.itens.map(item => item.href))).not.toContain("/pedidos");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", LAB_SUPABASE_URL);
  expect(gruposVisiveis(admin).flatMap(grupo => grupo.itens.map(item => item.href))).toEqual(expect.arrayContaining(["/pedidos", "/comunicados"]));
});

it("Lançar oferece só as ações permitidas", () => {
  expect(ACOES_LANCAR.filter(acao => acao.pode(consulta))).toHaveLength(0);
  expect(ACOES_LANCAR.filter(acao => acao.pode(almoxarife)).map(acao => acao.slug)).toEqual(["consumo"]);
});

it("endereços antigos de Obras e pedidos levam às telas novas", () => {
  expect(SECAO_ANTIGA).toMatchObject({ stock: "/estoque", orders: "/pedidos-adm", rentals: "/locacoes", people: "/apoio", alerts: "/dashboard#pendencias" });
});

it("celular: barra com 4 botões grandes; Menu abre a lista completa com Sair", () => {
  nav.path = "/pedidos-adm";
  render(<NavegacaoCelular profile={admin} rodape={<button type="button">Sair</button>}/>);
  const bar = screen.getByRole("navigation", { name: "Atalhos do celular" });
  expect(within(bar).getAllByRole("link").map(link => link.textContent)).toEqual(["Início", "Lançar", "Pedidos"]);
  expect(within(bar).getByRole("link", { name: "Pedidos" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(within(bar).getByRole("button", { name: "Menu" }));
  const menu = screen.getByRole("dialog", { name: "Menu completo" });
  expect(within(menu).getByRole("link", { name: "Usuários" })).toBeInTheDocument();
  expect(within(menu).getByRole("button", { name: "Sair" })).toBeInTheDocument();
  fireEvent.click(within(menu).getByRole("link", { name: "Estoque das obras" }));
  expect(screen.queryByRole("dialog", { name: "Menu completo" })).not.toBeInTheDocument();
});

it("abas do grupo no topo das telas", () => {
  nav.path = "/locacoes";
  render(<SubNav profile={admin} grupo="pedidos"/>);
  expect(screen.getByRole("link", { name: "Máquinas alugadas" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Pedidos à ADM" })).toBeInTheDocument();
});

it("Registrar consumo é uma tela só de consumo, com o formulário já aberto", () => {
  render(<SiteOperations initial={data} profile={almoxarife} mode="consumption"/>);
  expect(screen.getByRole("heading", { name: "Registrar consumo" })).toBeInTheDocument();
  // Uma operação só: a pergunta "Operação" nem aparece.
  expect(screen.queryByLabelText("Operação")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Equipe que consumiu")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Atualizar e enviar pendentes" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Uma obra pode reunir várias equipes/)).not.toBeInTheDocument();
});

it("Estoque das obras: cartões por local, com busca, sem formulários misturados", () => {
  render(<SiteOperations initial={data} profile={consulta} mode="stock"/>);
  expect(screen.getByRole("heading", { name: "Obra Norte" })).toBeInTheDocument();
  expect(screen.getByText("10 un")).toBeInTheDocument();
  expect(screen.getByText("4 kg")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /Movimentar|Receber|Entrega/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Procurar item"), { target: { value: "eletro" } });
  expect(screen.queryByText("10 un")).not.toBeInTheDocument();
  expect(screen.getByText("4 kg")).toBeInTheDocument();
});

it("Pedidos à ADM separa em andamento e concluídos", () => {
  render(<SiteOperations initial={data} profile={consulta} mode="orders"/>);
  expect(screen.getByRole("button", { name: "Em andamento (0)" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Nenhum pedido em andamento.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Concluídos (1)" }));
  expect(screen.getByRole("heading", { name: /Equipe Teste · Recebido por completo/ })).toBeInTheDocument();
});

it("telas do servidor leem os ícones de um módulo comum (não de módulo do navegador)", async () => {
  const { readFileSync } = await import("node:fs");
  expect(readFileSync("02_COMPONENTES_VISUAIS/icones-menu.ts", "utf8")).not.toMatch(/^["']use client["']/m);
  for (const page of ["app/(02_SISTEMA)/dashboard/page.tsx", "app/(02_SISTEMA)/lancar/page.tsx"])
    expect(readFileSync(page, "utf8")).not.toMatch(/import \{[^}]*ICONES[^}]*\} from "@\/02_COMPONENTES_VISUAIS\/sidebar-nav"/);
});

it("tabelas ganham o nome da coluna em cada célula (cartões no celular)", async () => {
  const { rotularTabelas } = await import("@/02_COMPONENTES_VISUAIS/rotulos-tabelas");
  document.body.innerHTML = `<table class="data-table"><thead><tr><th>Funcionário</th><th>Função</th><th>Ações</th></tr></thead>
    <tbody><tr><td>João</td><td colspan="1">Soldador</td><td><a>Abrir</a></td></tr><tr><td colspan="2">Sem dados</td><td>-</td></tr></tbody></table>`;
  rotularTabelas(document);
  const rows = document.querySelectorAll("tbody tr");
  expect([...rows[0].children].map(cell => (cell as HTMLElement).dataset.label)).toEqual(["Funcionário", "Função", "Ações"]);
  expect([...rows[1].children].map(cell => (cell as HTMLElement).dataset.label)).toEqual(["Funcionário", "Ações"]);
  document.body.innerHTML = "";
});
