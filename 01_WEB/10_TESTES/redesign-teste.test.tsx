import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { destinoLoginTeste, LAB_SUPABASE_URL, redesignTesteLiberado, TESTE_ONLINE_SUPABASE_URL } from "@/09_CONFIGURACOES/ambiente-teste-online";
import { DrawerColaborador, AtalhosColaborador } from "@/app/colaborador/[[...screen]]/drawer-colaborador";
import { LoginGalpao } from "@/02_COMPONENTES_VISUAIS/Galpao/login-galpao";

vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-roof-access.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-structure.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-renderer.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-camera.js", () => ({}));
vi.mock("@/02_COMPONENTES_VISUAIS/Galpao/steel-motion.js", () => ({}));
afterEach(() => { cleanup(); delete window.startMetalloSteel; vi.restoreAllMocks(); });

it("ativa a apresentação apenas no teste e nas prévias locais explícitas", () => {
  expect(redesignTesteLiberado({})).toBe(false);
  expect(redesignTesteLiberado({ NEXT_PUBLIC_SUPABASE_URL: "https://producao.supabase.co" })).toBe(false);
  expect(redesignTesteLiberado({ NEXT_PUBLIC_SUPABASE_URL: "https://producao.supabase.co", METALLO_LOCAL_PREVIEW: "1" })).toBe(false);
  expect(redesignTesteLiberado({ NEXT_PUBLIC_SUPABASE_URL: TESTE_ONLINE_SUPABASE_URL })).toBe(true);
  expect(redesignTesteLiberado({ METALLO_COLABORADOR_TESTE_ONLINE: "1" })).toBe(true);
  expect(redesignTesteLiberado({ NEXT_PUBLIC_SUPABASE_URL: LAB_SUPABASE_URL, METALLO_LOCAL_PREVIEW: "1" })).toBe(true);
  expect(redesignTesteLiberado({ METALLO_LOCAL_PREVIEW: "1", METALLO_COLABORADOR_VISUAL_PREVIEW: "1" })).toBe(true);
  expect(destinoLoginTeste("gestao", false)).toBe("https://metallo-teste-gestao.metallo-gunswiz.workers.dev/login");
  expect(destinoLoginTeste("colaborador", true)).toBe("http://127.0.0.1:3101/colaborador/login");
});

it("reutiliza as vinte e uma entradas pessoais no desktop e preserva funcionário sem equipe", () => {
  const logout = vi.fn(async () => {});
  render(<DrawerColaborador inline open={false} onClose={vi.fn()} trigger={createRef<HTMLButtonElement>()}
    profile={{ employee_id: "sintetico", full_name: "Funcionário de teste", profession: null, team_name: null }} current="privacidade" busy={false} logout={logout} demo={false} go={vi.fn()}/>);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("Sem equipe atribuída")).toBeInTheDocument();
  const nav = within(screen.getByRole("navigation", { name: "Navegação principal" }));
  expect(nav.getAllByRole("link")).toHaveLength(21);
  expect(nav.getByRole("link", { name: "Privacidade (seus dados)" })).toHaveAttribute("aria-current", "page");
  expect(nav.getByRole("link", { name: "Solicitar troca de EPI" })).toHaveAttribute("href", "/colaborador/epis#epi-troca-heading");
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  expect(logout).toHaveBeenCalledOnce();
});

it("atalhos móveis usam as rotas funcionais e abrem o menu existente", () => {
  const openMenu = vi.fn();
  render(<AtalhosColaborador current="ponto" demo={false} go={vi.fn()} openMenu={openMenu}/>);
  expect(screen.getByRole("link", { name: "Ponto" })).toHaveAttribute("href", "/colaborador/ponto");
  expect(screen.getByRole("link", { name: "Ponto" })).toHaveAttribute("aria-current", "page");
  fireEvent.click(screen.getByRole("button", { name: "Mais telas" })); expect(openMenu).toHaveBeenCalledOnce();
});

it("monta e desmonta o galpão sem substituir o formulário funcional", async () => {
  const destroy = vi.fn(), start = vi.fn(() => ({ destroy })), submit = vi.fn(); window.startMetalloSteel = start;
  const view = render(<LoginGalpao area="gestao" outroAcesso="https://metallo-teste-colaborador.metallo-gunswiz.workers.dev/colaborador/login">
    <form onSubmit={event => { event.preventDefault(); submit(); }}><label>Usuário<input name="email"/></label><button>Entrar</button></form>
  </LoginGalpao>);
  await waitFor(() => expect(start).toHaveBeenCalledOnce());
  fireEvent.change(screen.getByLabelText("Usuário"), { target: { value: "gestor" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(submit).toHaveBeenCalledOnce(); expect(screen.getByLabelText("Usuário")).toHaveValue("gestor");
  expect(screen.getByRole("link", { name: "Funcionário" })).toHaveAttribute("href", "https://metallo-teste-colaborador.metallo-gunswiz.workers.dev/colaborador/login");
  view.unmount(); expect(destroy).toHaveBeenCalledOnce();
});

it("uma falha no renderizador não impede entrar", async () => {
  window.startMetalloSteel = () => { throw new Error("WebGL indisponível"); };
  render(<LoginGalpao area="colaborador" outroAcesso="/login"><button>Entrar</button></LoginGalpao>);
  expect(await screen.findByRole("status")).toHaveTextContent("Você pode continuar o acesso normalmente");
  expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
});
