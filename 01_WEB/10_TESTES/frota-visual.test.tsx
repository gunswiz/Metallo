import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListaPrioridades, type Prioridade } from "@/02_COMPONENTES_VISUAIS/lista-prioridades";
import { PainelFrota } from "@/02_COMPONENTES_VISUAIS/Frota/painel-frota";
import { Frota } from "@/app/colaborador/[[...screen]]/frota";
import type { CaminhaoApp10a, ItemChecklist10a, PainelGestao10a, ViagemApp10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";

vi.mock("@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6", () => ({ prepararFoto: async (file: File) => file }));
afterEach(cleanup);
beforeEach(() => sessionStorage.clear());

const caminhao = (patch: Partial<CaminhaoApp10a> = {}): CaminhaoApp10a => ({
  id: 1, nome: "Munck São José", placa: "ABC1D23", modelo: "Volvo", situacao: "disponivel", km_atual: 10000,
  checklist_hoje: null, motorista: null, destino: null, saida_em: null, minha_viagem: null, ...patch,
});
const painel = (patch: Partial<PainelGestao10a> = {}): PainelGestao10a => ({
  ...caminhao(), ativo: true, ano: 2024, acompanhantes: null, checklist_hoje: "liberado", checklist_hoje_em: null,
  checklist_hoje_por: null, manutencoes_abertas: 0, docs_vencidos: 0, docs_breve: 0, planos_vencidos: 0, planos_breve: 0, ...patch,
});
const itens: ItemChecklist10a[] = Array.from({ length: 26 }, (_, i) => ({ codigo: i + 1, nome: `Conferência ${i + 1}`, critico: i === 0 }));
function acoes(veiculos: CaminhaoApp10a[] = [caminhao()], checklistItens = itens) {
  return {
    caminhoes: vi.fn(async () => veiculos), itens: vi.fn(async () => checklistItens), viagens: vi.fn(async (): Promise<ViagemApp10a[]> => []),
    checklist: vi.fn(async () => "liberado" as const), saida: vi.fn(async () => {}), chegada: vi.fn(async () => true),
    foto: vi.fn(async () => "foto-do-defeito"),
  };
}

describe("Início com prioridades", () => {
  it("limita a leitura inicial, mantém os urgentes no topo e permite acessar todos", () => {
    const prioridades: Prioridade[] = Array.from({ length: 7 }, (_, i) => ({ id: String(i), titulo: `Assunto ${i}`, descricao: `Detalhe ${i}`, href: `/assunto/${i}`, urgente: i === 5 }));
    render(<ListaPrioridades itens={prioridades}/>);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/assunto/5");
    expect(prioridades[0].id).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os 7 assuntos" }));
    expect(screen.getAllByRole("link")).toHaveLength(7);
    expect(screen.getByRole("link", { name: /Assunto 6/ })).toHaveAttribute("href", "/assunto/6");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar menos" }));
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
  it("não mostra controles extras quando não existem pendências", () => {
    render(<ListaPrioridades itens={[]}/>);
    expect(screen.getByText("Tudo em dia")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Frota da Gestão", () => {
  it("busca por placa, nome sem acento e motorista; limpa uma busca vazia", () => {
    render(<PainelFrota frota={[painel(), painel({ id: 2, nome: "Munck 02", placa: "DEF4G56", motorista: "João Silva", situacao: "em_uso", destino: "Obra Norte" })]}/>);
    const busca = screen.getByRole("searchbox");
    fireEvent.change(busca, { target: { value: "abc-1d23" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Abrir ficha" })).toHaveAttribute("href", "/frota/1");
    fireEvent.change(busca, { target: { value: "sao jose" } });
    expect(screen.getByRole("heading", { name: "Munck São José" })).toBeInTheDocument();
    fireEvent.change(busca, { target: { value: "joao" } });
    expect(screen.getByText("Obra Norte")).toBeInTheDocument();
    expect(screen.queryByText("Munck São José")).not.toBeInTheDocument();
    fireEvent.change(busca, { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum caminhão neste filtro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("filtra atenção sem perder veículos desativados ou sem checklist", () => {
    render(<PainelFrota frota={[painel(), painel({ id: 2, nome: "Documento vencido", docs_vencidos: 1 }), painel({ id: 3, nome: "Falta checklist", checklist_hoje: null }), painel({ id: 4, nome: "Desativado antigo", ativo: false })]}/>);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Atenção/ }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("Documento vencido")).toBeInTheDocument();
    expect(screen.getByText("Falta checklist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Desativados/ }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Desativado antigo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Desativados/ })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Caminhões do funcionário", () => {
  it("prioriza a chegada do caminhão com a pessoa e oferece saída só com checklist liberado", async () => {
    const api = acoes([caminhao(), caminhao({ id: 2, nome: "Meu caminhão", situacao: "em_uso", minha_viagem: 55 }), caminhao({ id: 3, nome: "Liberado", checklist_hoje: "ressalvas" }), caminhao({ id: 4, nome: "Bloqueado", situacao: "nao_liberado", checklist_hoje: "nao_liberado" })]);
    const { container } = render(<Frota acoes={api}/>);
    await screen.findByRole("button", { name: "Registrar chegada" });
    expect(container.querySelector("ul > li")).toHaveTextContent("Meu caminhão");
    expect(screen.getAllByRole("button", { name: "Registrar saída" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Com você" }));
    expect(screen.getByText("Meu caminhão")).toBeInTheDocument();
    expect(screen.queryByText("Munck São José")).not.toBeInTheDocument();
  });
  it("retoma o checklist de onde parou se a página recarregar ao abrir a câmera", async () => {
    const api = acoes();
    const primeira = render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    const primeiro = screen.getByRole("group", { name: "Conferência 1" });
    fireEvent.click(within(primeiro).getByRole("button", { name: "Problema" }));
    fireEvent.change(screen.getByLabelText("O que está errado: Conferência 1"), { target: { value: "Freio com ruído" } });
    primeira.unmount(); // como se a página tivesse recarregado
    render(<Frota acoes={api}/>);
    expect(await screen.findByRole("heading", { name: /Checklist/ })).toBeInTheDocument();
    expect(screen.getByLabelText("O que está errado: Conferência 1")).toHaveValue("Freio com ruído");
    expect(screen.getByRole("status")).toHaveTextContent("Continue de onde parou");
  });
  it("exige respostas em cada etapa, preserva escolhas/foto ao voltar e envia os 26 itens uma única vez", async () => {
    const api = acoes();
    const { container } = render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    expect(screen.getByRole("heading", { name: "Checklist · etapa 1 de 6" })).toHaveFocus();
    expect(screen.getAllByRole("group")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Confira o item 1");
    const primeiro = screen.getByRole("group", { name: "Conferência 1" });
    fireEvent.click(within(primeiro).getByRole("button", { name: "Problema" }));
    fireEvent.change(screen.getByLabelText("O que está errado: Conferência 1"), { target: { value: "Freio com ruído" } });
    fireEvent.click(screen.getByRole("button", { name: "Tirar foto do defeito" }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["foto"], "defeito.jpg", { type: "image/jpeg" })] } });
    await screen.findByRole("button", { name: /Foto anexada/ });
    screen.getAllByRole("group").slice(1).forEach(g => fireEvent.click(within(g).getByRole("button", { name: "Conforme" })));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("heading", { name: "Checklist · etapa 2 de 6" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(within(screen.getByRole("group", { name: "Conferência 1" })).getByRole("button", { name: "Problema" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("O que está errado: Conferência 1")).toHaveValue("Freio com ruído");
    expect(screen.getByRole("button", { name: /Foto anexada/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    for (let etapa = 2; etapa <= 5; etapa++) {
      screen.getAllByRole("group").forEach(g => fireEvent.click(within(g).getByRole("button", { name: "Conforme" })));
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    }
    expect(screen.getByRole("heading", { name: "Checklist · etapa 6 de 6" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Não se aplica" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "26");
    fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
    expect(api.checklist).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Marque que você está ciente");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
    await waitFor(() => expect(api.checklist).toHaveBeenCalledTimes(1));
    const [veiculo, local, obs, respostas, chave] = (api.checklist.mock.calls as unknown as [number, string, string, unknown[], string][])[0];
    expect([veiculo, local, obs]).toEqual([1, "", ""]);
    expect(respostas).toHaveLength(26);
    expect(respostas[0]).toEqual({ codigo: 1, situacao: "N", obs: "Freio com ruído", foto: "foto-do-defeito" });
    expect(respostas[25]).toEqual({ codigo: 26, situacao: "NA", obs: "" });
    expect(chave).toMatch(/^[a-f0-9-]{36}$/);
    await screen.findByText("Checklist feito. Caminhão liberado.");
  });
  it("mantém a etapa quando um problema não tem descrição", async () => {
    render(<Frota acoes={acoes()}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    screen.getAllByRole("group").forEach(g => fireEvent.click(within(g).getByRole("button", { name: "Conforme" })));
    fireEvent.click(within(screen.getByRole("group", { name: "Conferência 3" })).getByRole("button", { name: "Problema" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByRole("status")).toHaveTextContent("Confira o item 3");
    expect(screen.getByRole("heading", { name: "Checklist · etapa 1 de 6" })).toBeInTheDocument();
  });
  it("valida o km e mantém o formulário após erro, permitindo tentar novamente", async () => {
    const api = acoes([caminhao({ checklist_hoje: "liberado" })]);
    api.saida.mockRejectedValueOnce(new Error("veiculo_em_uso"));
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar saída" }));
    fireEvent.change(screen.getByLabelText("Para onde vai?"), { target: { value: "Obra Norte" } });
    fireEvent.change(screen.getByLabelText("Km do painel agora"), { target: { value: "9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    expect(api.saida).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("10.000 ou mais");
    fireEvent.change(screen.getByLabelText("Km do painel agora"), { target: { value: "10.005" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    await screen.findByText("Este caminhão já está na rua.");
    expect(screen.getByLabelText("Para onde vai?")).toHaveValue("Obra Norte");
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    await screen.findByText("Saída registrada. Boa viagem!");
    expect(api.saida).toHaveBeenCalledTimes(2);
    const chamadas = api.saida.mock.calls as unknown as [number, string, string, number, string, string][];
    expect(chamadas[1].slice(0, 5)).toEqual([1, "Obra Norte", "", 10005, ""]);
    expect(chamadas[1][5]).toBe(chamadas[0][5]);
  });
  it("recupera falha de carregamento e impede envio sem itens de checklist", async () => {
    const api = acoes([caminhao()], []);
    api.caminhoes.mockRejectedValueOnce(new Error("offline"));
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Tentar novamente" }));
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    expect(screen.getByRole("button", { name: "Enviar checklist" })).toBeDisabled();
    expect(api.checklist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos caminhões" }));
    expect(screen.getByRole("button", { name: "Fazer checklist" })).toBeInTheDocument();
  });
});
