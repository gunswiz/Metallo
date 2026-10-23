import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SessionProfile } from "@metallo/types";
import type { FichaGestao10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";

const estado = vi.hoisted(() => ({ role: "admin", novo: true }));
vi.mock("next/navigation", () => ({ usePathname: () => "/frota/1", notFound: () => { throw new Error("404"); } }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: vi.fn(async () => ({ id: "gestor", fullName: "Gestor Teste", role: estado.role, active: true, operationPermissions: ["equipment:write"] } as SessionProfile)) }));
vi.mock("@/09_CONFIGURACOES/ambienteSupabase", () => ({ getSupabaseEnv: () => ({ url: "https://teste.supabase.co" }) }));
vi.mock("@/09_CONFIGURACOES/ambiente-teste-online", () => ({ recursosNovosLiberados: () => estado.novo }));
vi.mock("@/03_FUNCOES_E_LOGICA/executarOperacaoValidada", () => ({ executeValidated: vi.fn(async () => ({ status: "success" })) }));
vi.mock("@/02_COMPONENTES_VISUAIS/formulario-operacao", () => ({ OperationForm: ({ children, label }: { children: ReactNode; label: string }) => <form>{children}<button>{label}</button></form> }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/frota-10a", () => ({
  lerFichaFrota10a: vi.fn(), lerItensFrota10a: vi.fn(async () => [{ codigo: 1, nome: "Freios", critico: true, ativo: true }]),
  lerMesFrota10a: vi.fn(async () => []), lerFotosChegadaFrota10b: vi.fn(async () => []), lerChecklistFrota10a: vi.fn(async () => null),
  lerPainelFrota10a: vi.fn(async () => []),
  lerAtencaoFrota10a: vi.fn(async () => [
    { veiculo_id: 1, nome: "Munck 01", texto: "Seguro vencido", tipo: "documento", gravidade: "vencido" },
    { veiculo_id: 2, nome: "Munck 02", texto: "Troca de óleo", tipo: "plano", gravidade: "breve" },
  ]), requireFrota10a: vi.fn(),
}));
import FichaFrotaPage from "@/app/(02_SISTEMA)/frota/[id]/page";
import FrotaPage from "@/app/(02_SISTEMA)/frota/page";
import ItensFrotaPage from "@/app/(02_SISTEMA)/frota/itens/page";
import { lerFichaFrota10a, lerChecklistFrota10a } from "@/05_ACESSO_A_DADOS/Supabase/frota-10a";
import { executeValidated } from "@/03_FUNCOES_E_LOGICA/executarOperacaoValidada";
import { concluirPlano10a, salvarCaminhao10a, salvarDocumento10a, salvarPlano10a } from "@/app/actions/frota-10a";

const ficha: FichaGestao10a = { veiculo: { id: 1, nome: "Munck 01", placa: "ABC1D23", modelo: null, ano: 2024, situacao: "disponivel", km_atual: 10000, ativo: true }, documentos: [], planos: [], manutencoes: [], viagens: [], checklists: [], eventos: [] };
beforeEach(() => { vi.clearAllMocks(); estado.role = "admin"; estado.novo = true; vi.mocked(lerFichaFrota10a).mockResolvedValue(ficha); });
afterEach(cleanup);
const pagina = (query: { aba?: string; mes?: string; checklist?: string } = {}) => FichaFrotaPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve(query) });

it("a ficha abre somente o assunto escolhido e fornece links para os demais", async () => {
  render(await pagina({ aba: "documentos" }));
  expect(screen.getByRole("heading", { name: "Documentos e vencimentos" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Manutenção" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Saídas e chegadas" })).not.toBeInTheDocument();
  const abas = screen.getByRole("navigation", { name: "Assuntos do caminhão" });
  expect(within(abas).getByRole("link", { name: "Documentos" })).toHaveAttribute("aria-current", "page");
  expect(within(abas).getByRole("link", { name: "Preventivas" })).toHaveAttribute("href", "/frota/1?aba=planos");
  expect(within(abas).getAllByRole("link")).toHaveLength(7);
});

it("o link antigo do mês abre Checklists e a grade, sem a lista de manutenção", async () => {
  const { container } = render(await pagina({ mes: "2026-10" }));
  expect(screen.getByRole("heading", { name: "Checklists" })).toBeInTheDocument();
  expect(container.querySelector("#grade")).toHaveAttribute("open");
  expect(screen.getAllByRole("columnheader")).toHaveLength(32);
  expect(screen.getByRole("link", { name: "← Mês anterior" })).toHaveAttribute("href", "/frota/1?mes=2026-09#grade");
  expect(screen.queryByRole("heading", { name: "Manutenção" })).not.toBeInTheDocument();
});

it("links existentes de checklist continuam selecionando o assunto certo", async () => {
  render(await pagina({ checklist: "17" }));
  expect(lerChecklistFrota10a).toHaveBeenCalledWith(17);
  expect(screen.getByRole("heading", { name: "Checklists" })).toBeInTheDocument();
  expect(screen.getByText("Grade mensal do checklist").closest("details")).not.toHaveAttribute("open");
});

it("um operador não recebe o cadastro ao forçar a aba na URL", async () => {
  estado.role = "collaborator";
  render(await pagina({ aba: "dados" }));
  expect(screen.getByRole("heading", { name: "Manutenção" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Cadastro" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Salvar dados" })).not.toBeInTheDocument();
});

it("os alertas levam ao assunto correspondente e o cadastro só abre quando solicitado", async () => {
  const { unmount } = render(await FrotaPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("link", { name: /Seguro vencido/ })).toHaveAttribute("href", "/frota/1?aba=documentos");
  expect(screen.getByRole("link", { name: /Troca de óleo/ })).toHaveAttribute("href", "/frota/2?aba=planos");
  expect(screen.getByText("Novo veículo").closest("details")).not.toHaveAttribute("open");
  unmount();
  render(await FrotaPage({ searchParams: Promise.resolve({ novo: "1" }) }));
  expect(screen.getByText("Novo veículo").closest("details")).toHaveAttribute("open");
});

it("a configuração de cada item começa recolhida, mas mantém os campos editáveis", async () => {
  render(await ItensFrotaPage({ searchParams: Promise.resolve({}) }));
  const item = screen.getByText("1. Freios").closest("details")!;
  expect(item).not.toHaveAttribute("open");
  fireEvent.click(within(item).getByText("Editar"));
  expect(item).toHaveAttribute("open");
  expect(within(item).getByRole("textbox", { name: "1. Nome" })).toHaveValue("Freios");
  expect(within(item).getByRole("checkbox", { name: "Crítico (bloqueia o caminhão)" })).toBeChecked();
});

it("o gate de recursos novos continua protegendo as telas", async () => {
  estado.novo = false;
  await expect(pagina()).rejects.toThrow("404");
  await expect(FrotaPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("404");
  expect(lerFichaFrota10a).not.toHaveBeenCalled();
});

it("salvar um assunto mantém o usuário na mesma aba", async () => {
  for (const [action, aba] of [[salvarDocumento10a, "documentos"], [salvarPlano10a, "planos"], [concluirPlano10a, "planos"], [salvarCaminhao10a, "dados"]] as const) {
    await action(undefined, new FormData());
    const config = vi.mocked(executeValidated).mock.calls.at(-1)![0];
    const destination = config.destination as (data: { id: number; veiculoId: number }) => string;
    expect(destination({ id: 1, veiculoId: 1 })).toBe(`/frota/1?ok=1&aba=${aba}`);
  }
});
