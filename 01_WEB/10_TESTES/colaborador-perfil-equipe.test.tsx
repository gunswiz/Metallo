// @vitest-environment-options {"url":"http://127.0.0.1:3101"}
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ColaboradorApp from "@/app/colaborador/[[...screen]]/colaborador-app";
import { personalTeam } from "@/05_ACESSO_A_DADOS/Supabase/colaborador-local";

const state = vi.hoisted(() => ({
  actor: "joao", team: "A" as "A" | "B" | "none" | "error", replace: vi.fn(), signOut: vi.fn(), pointRequest: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/ponto-lab", async importOriginal => {
  const actual = await importOriginal<typeof import("@/05_ACESSO_A_DADOS/Ponto/ponto-lab")>();
  return { ...actual, pointRequest: state.pointRequest };
});
const people = {
  joao: { employee_id: "joao", full_name: "João Sintético", profession: "Soldador", team_name: "Equipe A" },
  maria: { employee_id: "maria", full_name: "Maria Sintética", profession: "Montadora", team_name: "Equipe B" },
};
const teams = {
  A: { team_name: "Equipe A", work_name: "Obra A", member_count: 2, members: [{ name: "João Sintético", profession: "Soldador" }, { name: "Colega A", profession: "Montador" }] },
  B: { team_name: "Equipe B", work_name: "Obra B", member_count: 2, members: [{ name: "Maria Sintética", profession: "Montadora" }, { name: "Colega B", profession: "Caldeireiro" }] },
};
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  auth: {
    getUser: async () => ({ data: { user: { id: state.actor } }, error: null }),
    getSession: async () => ({ data: { session: { access_token: "jwt-sintetico" } }, error: null }),
    signOut: state.signOut, dispose: async () => {},
  },
  rpc: async (name: string) => {
    if (name === "my_employee_profile") return { data: [people[state.actor as keyof typeof people]], error: null };
    if (state.team === "error") return { data: null, error: new Error("Failed to fetch") };
    if (name === "my_team_summary") return { data: state.team === "none" ? [] : [teams[state.team]], error: null };
    if (name === "my_current_work") return { data: state.team === "none" ? [] : [{ work_id: "a4b63cb6-e379-4b45-bfb2-2a541401fbc9", work_name: teams[state.team].work_name }], error: null };
    throw new Error(`RPC não prevista: ${name}`);
  },
}) }));

beforeEach(() => {
  state.actor = "joao"; state.team = "A";
  state.replace.mockReset(); state.signOut.mockReset(); state.pointRequest.mockReset();
  state.signOut.mockResolvedValue({ error: null });
  state.pointRequest.mockResolvedValue({ status: 200, body: { status: "SESSAO_ENCERRADA" } });
  localStorage.clear();
});
afterEach(cleanup);

it("Perfil combina DTO mínimo, Minha Obra e Equipe sem expor campos administrativos", async () => {
  render(<ColaboradorApp screen="perfil" anonKey="anon-local" />);
  expect(await screen.findByRole("heading", { name: "João Sintético" })).toBeInTheDocument();
  expect(screen.getByText("Soldador")).toBeInTheDocument();
  expect(screen.getByText("Equipe A")).toBeInTheDocument();
  expect(screen.getByText("Obra A")).toBeInTheDocument();
  expect(screen.getByText("Acesso ativo")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: /Minha Equipe/ }).some(link => link.getAttribute("href") === "/colaborador/equipe")).toBe(true);
  expect(screen.getAllByRole("link", { name: /Meus EPIs/ }).some(link => link.getAttribute("href") === "/colaborador/epis")).toBe(true);
  expect(screen.getByRole("button", { name: "Sair de todos os dispositivos" })).toBeInTheDocument();
  expect(screen.queryByText(/CPF|ASO|salário|authorization_version|service_role/i)).not.toBeInTheDocument();
});

it("Minha Equipe mostra somente integrantes mínimos e registra responsável ausente", async () => {
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  expect(await screen.findByRole("heading", { name: "Equipe A" })).toBeInTheDocument();
  expect(screen.getByText("Colega A")).toBeInTheDocument();
  expect(screen.getByText("Montador")).toBeInTheDocument();
  expect(screen.getByText("Não cadastrado")).toBeInTheDocument();
  expect(screen.queryByText("Colega B")).not.toBeInTheDocument();
  expect(screen.queryByText(/CPF|ASO|telefone|salário/i)).not.toBeInTheDocument();
});

it("sem equipe mantém Perfil, acesso e estado vazio de Equipe", async () => {
  state.team = "none";
  const view = render(<ColaboradorApp screen="perfil" anonKey="anon-local" />);
  expect(await screen.findByText("Sem equipe atribuída")).toBeInTheDocument();
  expect(screen.getByText("Sem obra atribuída no momento.")).toBeInTheDocument();
  expect(screen.getByText("Acesso ativo")).toBeInTheDocument();
  view.unmount();
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  expect(await screen.findByText("Sem equipe atribuída no momento.")).toBeInTheDocument();
  expect(state.signOut).not.toHaveBeenCalled();
});

it("troca de equipe por foco esconde colegas antigos antes da nova leitura", async () => {
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  expect(await screen.findByText("Colega A")).toBeInTheDocument();
  state.team = "B";
  fireEvent.focus(window);
  expect(screen.queryByText("Colega A")).not.toBeInTheDocument();
  expect(await screen.findByText("Colega B")).toBeInTheDocument();
});

it("troca de conta entre abas remove João antes de mostrar Maria", async () => {
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  expect(await screen.findByText("Colega A")).toBeInTheDocument();
  state.actor = "maria"; state.team = "B";
  fireEvent(window, new StorageEvent("storage", { key: "metallo-colaborador-laboratorio", newValue: "sessao-maria" }));
  expect(screen.queryByText("Colega A")).not.toBeInTheDocument();
  expect(await screen.findByText("Colega B")).toBeInTheDocument();
  expect(screen.queryByText("João Sintético")).not.toBeInTheDocument();
});

it("laboratório indisponível elimina dados antigos e permite nova tentativa", async () => {
  render(<ColaboradorApp screen="equipe" anonKey="anon-local" />);
  expect(await screen.findByText("Colega A")).toBeInTheDocument();
  state.team = "error";
  fireEvent.focus(window);
  expect(screen.queryByText("Colega A")).not.toBeInTheDocument();
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao servidor");
  state.team = "B";
  // Sob carga, a revalidação disparada pelo foco pode terminar depois do primeiro toque e descartar
  // aquela leitura ("Sessão alterada"); nesse caso a tela continua oferecendo "Tentar novamente".
  await waitFor(() => {
    const retry = screen.queryByRole("button", { name: "Tentar novamente" });
    if (retry) fireEvent.click(retry);
    expect(screen.getByText("Colega B")).toBeInTheDocument();
  }, { timeout: 8000, interval: 300 });
}, 15000);

it("saída global na área de segurança usa o fluxo aprovado e esconde o perfil", async () => {
  render(<ColaboradorApp screen="perfil" anonKey="anon-local" />);
  fireEvent.click(await screen.findByRole("button", { name: "Sair de todos os dispositivos" }));
  expect(screen.queryByRole("heading", { name: "João Sintético" })).not.toBeInTheDocument();
  await waitFor(() => expect(state.pointRequest).toHaveBeenCalledWith("/lab-point/v1/session/global", "jwt-sintetico", expect.objectContaining({ method: "POST" })));
});

it("parser recusa colega com campo extra sensível, contagem divergente e objeto amplo", () => {
  expect(() => personalTeam([{ ...teams.A, members: [{ ...teams.A.members[0], cpf: "não permitido" }, teams.A.members[1]] }])).toThrow("Contrato pessoal de equipe inválido");
  expect(() => personalTeam([{ ...teams.A, member_count: 7 }])).toThrow("Contrato pessoal de equipe inválido");
  expect(() => personalTeam([{ ...teams.A, authorization_version: 9 }])).toThrow("Contrato pessoal de equipe inválido");
});

it("parser aceita a função substituta emitida pela RPC para profissão em branco", () => {
  const data = [{ ...teams.A, member_count: 3, members: [...teams.A.members, { name: "Colega Sem Função 3A", profession: "Função não informada" }] }];
  expect(personalTeam(data)?.members[2]).toEqual({ name: "Colega Sem Função 3A", profession: "Função não informada" });
});
