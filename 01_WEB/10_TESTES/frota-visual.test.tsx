import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ListaPrioridades, type Prioridade } from "@/02_COMPONENTES_VISUAIS/lista-prioridades";
import { PainelFrota } from "@/02_COMPONENTES_VISUAIS/Frota/painel-frota";
import { Frota } from "@/app/colaborador/[[...screen]]/frota";
import type { CaminhaoApp10a, ItemChecklist10a, PainelGestao10a, ViagemApp10a } from "@/03_FUNCOES_E_LOGICA/Frota/contrato-10a";

vi.mock("@/03_FUNCOES_E_LOGICA/Arquivos/contrato-6", () => ({ prepararFoto: async (file: File) => file }));
afterEach(cleanup);
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

const caminhao = (patch: Partial<CaminhaoApp10a> = {}): CaminhaoApp10a => ({
  id: 1, nome: "Munck São José", placa: "ABC1D23", modelo: "Volvo", situacao: "disponivel", km_atual: 10000,
  checklist_hoje: null, motorista: null, destino: null, saida_em: null, minha_viagem: null, ...patch,
});
const painel = (patch: Partial<PainelGestao10a> = {}): PainelGestao10a => ({
  ...caminhao(), ativo: true, ano: 2024, acompanhantes: null, checklist_hoje: "liberado", checklist_hoje_em: null,
  checklist_hoje_por: null, manutencoes_abertas: 0, docs_vencidos: 0, docs_breve: 0, planos_vencidos: 0, planos_breve: 0, ...patch,
});
const itens: ItemChecklist10a[] = Array.from({ length: 26 }, (_, i) => ({ codigo: i + 1, nome: `Conferência ${i + 1}`, critico: i === 0, versao: "a".repeat(64) }));
function acoes(veiculos: CaminhaoApp10a[] = [caminhao()], checklistItens = itens) {
  return {
    quem: "conta-teste",
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
  it("seleciona o resumo e leva ao assunto pendente sem sair da lista", () => {
    render(<PainelFrota frota={[painel(), painel({ id: 2, nome: "Veículo com documento", docs_vencidos: 2 })]}/>);
    const resumo = screen.getByRole("complementary", { name: "Resumo do veículo selecionado" });
    expect(within(resumo).getByRole("link", { name: "Regularizar documentos" })).toHaveAttribute("href", "/frota/2?aba=documentos");
    fireEvent.click(screen.getByRole("button", { name: "Ver resumo de Munck São José" }));
    expect(within(resumo).getByRole("link", { name: "Conferir inspeções" })).toHaveAttribute("href", "/frota/1?aba=checklists");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "documento" } });
    expect(within(resumo).getByRole("link", { name: "Regularizar documentos" })).toHaveAttribute("href", "/frota/2?aba=documentos");
  });
  it("prioriza bloqueios e vencimentos sem alterar a ordem dos dados de origem", () => {
    const frota = [painel(), painel({ id: 2, nome: "Vencido", docs_vencidos: 1 }), painel({ id: 3, nome: "Bloqueado", situacao: "nao_liberado" })];
    render(<PainelFrota frota={frota}/>);
    expect(screen.getAllByRole("article").map(a => within(a).getByRole("heading").textContent)).toEqual(["Bloqueado", "Vencido", "Munck São José"]);
    expect(frota.map(v => v.id)).toEqual([1, 2, 3]);
  });
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
  it("consulta conferência da Gestão sem recriar checklist do defeito resolvido", async () => {
    const payload = { tipo: "checklist", local: "Pátio", obs: "Original", respostas: [{ codigo: 1, situacao: "N", obs: "Freio antigo" }] };
    localStorage.setItem("metallo-frota-recusadas-10d:conta-teste", JSON.stringify([{ id: "antigo", nome: "Munck", tipo: "checklist", motivo: "Itens mudaram", registro: { id: "antigo", veiculo: 1, nome: "Munck", criado: new Date().toISOString(), payload } }]));
    const prova = { chave: "antigo", veiculo: 1, relato: payload, recebido_em: "2026-11-02T10:00:00Z", conferido_em: null, motivo: null };
    const conferirRecusa = vi.fn().mockResolvedValueOnce(prova).mockResolvedValue({ ...prova, conferido_em: "2026-11-02T11:00:00Z", motivo: "Conserto verificado" });
    const api = { ...acoes([caminhao({ checklist_hoje: "liberado" })]), conferirRecusa };
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Enviar relato guardado para conferência" }));
    const consultar = await screen.findByRole("button", { name: "Consultar conferência da Gestão" });
    await waitFor(() => expect(consultar).toBeEnabled());
    fireEvent.click(consultar);
    await screen.findByText(/Relato conferido pela Gestão: Conserto verificado/);
    expect(api.checklist).not.toHaveBeenCalled();
    expect(api.chegada).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("metallo-frota-recusadas-10d:conta-teste")!)[0].registro.payload).toEqual(payload);
  });
  it("recupera os problemas recusados para o checklist atual sem apagar o histórico", async () => {
    localStorage.setItem("metallo-frota-recusadas-10d:conta-teste", JSON.stringify([{ id: "antigo", nome: "Munck", tipo: "checklist", motivo: "Itens mudaram", registro: { id: "antigo", veiculo: 1, nome: "Munck", criado: new Date().toISOString(), payload: { tipo: "checklist", local: "Pátio", obs: "Observação original", respostas: [{ codigo: 1, situacao: "N", obs: "Freio vazando", versao: "a".repeat(64) }] } } }]));
    const api = { ...acoes([caminhao()], [itens[0], itens[1]]), checklist: vi.fn(async () => "nao_liberado" as const) };
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Refazer checklist com este relato" }));
    expect(screen.getByLabelText("O que está errado: Conferência 1")).toHaveValue("Freio vazando");
    expect(screen.getByLabelText("Local (opcional)")).toHaveValue("Pátio");
    fireEvent.click(within(screen.getByRole("group", { name: "Conferência 2" })).getByRole("button", { name: "Conforme" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
    await screen.findByText(/O mesmo relato foi aceito/);
    const history = JSON.parse(localStorage.getItem("metallo-frota-recusadas-10d:conta-teste")!);
    expect(history[0].recebidoEmRegistro).toBeTruthy();
    expect(history[0].registro.payload.respostas[0].obs).toBe("Freio vazando");
  });
  it("rascunho conserva as perguntas recebidas mesmo quando a configuração muda", async () => {
    const api = acoes([caminhao()], [itens[0]]);
    const view = render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Problema" }));
    fireEvent.change(screen.getByLabelText("O que está errado: Conferência 1"), { target: { value: "Problema original" } });
    view.unmount();
    render(<Frota acoes={acoes([caminhao()], [{ ...itens[0], nome: "Pergunta diferente", versao: "b".repeat(64) }])}/>);
    expect(await screen.findByDisplayValue("Problema original")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Conferência 1" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Pergunta diferente" })).not.toBeInTheDocument();
    expect(screen.getByText(/Rascunho de uma versão anterior/)).toBeInTheDocument();
  });
  it("recusa de versão no envio direto preserva defeito e não preenche nova pergunta pelo código", async () => {
    const api = { ...acoes([caminhao({ checklist_hoje: "liberado" })], [itens[0]]), checklist: vi.fn().mockRejectedValue(new Error("checklist_versao_desatualizada")) };
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Refazer checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Problema" }));
    fireEvent.change(screen.getByLabelText("O que está errado: Conferência 1"), { target: { value: "Defeito guardado" } });
    fireEvent.click(screen.getByRole("checkbox"));
    api.itens.mockResolvedValue([{ ...itens[0], nome: "Pergunta diferente", versao: "b".repeat(64) }]);
    fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
    fireEvent.click(await screen.findByRole("button", { name: "Refazer checklist com este relato" }));
    expect(screen.getByRole("group", { name: "Pergunta diferente" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Defeito guardado")).not.toBeInTheDocument();
    const original = JSON.parse(localStorage.getItem("metallo-frota-recusadas-10d:conta-teste")!)[0];
    expect(original.registro.payload.respostas[0]).toMatchObject({ versao: "a".repeat(64), nome: "Conferência 1", obs: "Defeito guardado" });
    expect(original.recebidoEmRegistro).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Registrar saída" })).not.toBeInTheDocument();
  });
  it("falha de conexão em checkpoint sob revisão orienta reenvio manual", async () => {
    const api = acoes([caminhao({ situacao: "em_uso", minha_viagem: 4 })]);
    api.chegada.mockRejectedValue(new Error("Failed to fetch"));
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
    try {
      render(<Frota acoes={api}/>);
      fireEvent.click(await screen.findByRole("button", { name: "Registrar chegada" }));
      localStorage.setItem("metallo-frota-fila-10d:conta-teste", JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111", veiculo: 1, nome: "Munck", criado: new Date().toISOString(), revisar: true, payload: { tipo: "chegada", viagem: 4, km: 10000, problema: "Freio", obs: "" } }]));
      fireEvent.change(screen.getByLabelText("O caminhão teve algum problema? (deixe vazio se não)"), { target: { value: "Freio" } });
      fireEvent.click(screen.getByRole("button", { name: "Registrar chegada" }));
      await screen.findByText(/Quando o sinal voltar, confira o registro e toque em Enviar agora/);
      expect(screen.queryByText(/Será enviado quando o sinal voltar/)).not.toBeInTheDocument();
    } finally { uuid.mockRestore(); }
  });
  it("mostra defeito recusado, não oferece descarte nem saída", async () => {
    localStorage.setItem("metallo-frota-recusadas-10d:conta-teste", JSON.stringify([{ id: "critico", nome: "Munck", tipo: "checklist", motivo: "Responda todos os itens", registro: { id: "critico", veiculo: 1, nome: "Munck", criado: new Date().toISOString(), payload: { tipo: "checklist", local: "Obra", obs: "Relato retido", respostas: [{ codigo: 1, situacao: "N", obs: "Freio com vazamento" }] } } }]));
    render(<Frota acoes={acoes([caminhao({ checklist_hoje: "liberado" })])}/>);
    await screen.findByText("Ver relato guardado de Munck");
    fireEvent.click(screen.getByText("Ver relato guardado de Munck"));
    expect(screen.getByText("Item 1: Freio com vazamento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entendi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar saída" })).not.toBeInTheDocument();
  });
  it("permite enviar relato crítico sem foto por decisão explícita na tela", async () => {
    const api = acoes();
    localStorage.setItem("metallo-frota-fila-10d:conta-teste", JSON.stringify([{ id: "pendente", veiculo: 1, nome: "Munck São José", criado: new Date().toISOString(), fotoPendente: true, revisar: true, payload: { tipo: "checklist", local: "", obs: "", respostas: [{ codigo: 1, situacao: "N", obs: "Falha no freio", foto: "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4" }] } }]));
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Enviar relato sem fotos pendentes de Munck São José" }));
    await waitFor(() => expect(api.checklist).toHaveBeenCalledWith(1, "", expect.stringContaining("por decisão do funcionário"), [{ codigo: 1, situacao: "N", obs: "Falha no freio" }], "pendente"));
  });
  it("verifica pendências novamente antes de enviar uma saída já aberta", async () => {
    const api = acoes([caminhao({ checklist_hoje: "liberado" })]);
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar saída" }));
    fireEvent.change(screen.getByLabelText("Para onde vai?"), { target: { value: "Obra" } });
    localStorage.setItem("metallo-frota-fila-10d:conta-teste", JSON.stringify([{ id: "pendente", veiculo: 1, nome: "Munck", criado: new Date().toISOString(), revisar: true, payload: { tipo: "checklist", local: "", obs: "", respostas: [] } }]));
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    await screen.findByText(/Há registros pendentes/);
    expect(api.saida).not.toHaveBeenCalled();
  });
  it("falha ao criar chave não deixa formulário travado", async () => {
    const api = acoes([caminhao()], [itens[0]]);
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Conforme" }));
    fireEvent.click(screen.getByRole("checkbox"));
    const uuid = vi.spyOn(crypto, "randomUUID").mockImplementation(() => { throw new Error("indisponível"); });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Enviar checklist" })).toBeEnabled());
      expect(api.checklist).not.toHaveBeenCalled();
    } finally { uuid.mockRestore(); }
  });
  it("ignora rascunho legado sem proprietário e não persiste sem identidade", async () => {
    const legado = JSON.stringify({ em: Date.now(), tipo: "checklist", veiculo: 1, etapa: 0, respostas: {}, obs: "Legado sem dono" });
    sessionStorage.setItem("metallo-frota-rascunho", legado);
    render(<Frota acoes={{ ...acoes(), quem: undefined }}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    expect(screen.queryByDisplayValue("Legado sem dono")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("metallo-frota-rascunho")).toBe(legado);
    expect(sessionStorage.length).toBe(1);
  });
  it("um checklist conforme não anuncia liberação de um veículo que continua bloqueado", async () => {
    const api = acoes([caminhao({ situacao: "nao_liberado" })], [itens[0]]);
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    fireEvent.click(screen.getByRole("button", { name: "Conforme" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Enviar checklist" }));
    await screen.findByText(/bloqueios anteriores continuam válidos/);
    expect(screen.queryByRole("button", { name: "Registrar saída" })).not.toBeInTheDocument();
    expect(screen.queryByText("Checklist feito. Caminhão liberado.")).not.toBeInTheDocument();
  });
  it("não restaura o rascunho de outra conta ao trocar de identidade na mesma tela", async () => {
    const api = acoes();
    const view = render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Conferência 1" })).getByRole("button", { name: "Problema" }));
    fireEvent.change(screen.getByLabelText("O que está errado: Conferência 1"), { target: { value: "Relato da primeira conta" } });
    view.rerender(<Frota acoes={{ ...acoes(), quem: "outra-conta" }}/>);
    await screen.findByRole("button", { name: "Fazer checklist" });
    expect(screen.queryByDisplayValue("Relato da primeira conta")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("metallo-frota-rascunho:outra-conta")).toBeNull();
    view.rerender(<Frota acoes={api}/>);
    expect(await screen.findByDisplayValue("Relato da primeira conta")).toBeInTheDocument();
  });
  it.each([null, "liberado"] as const)("checklist pendente não oferece saída mesmo com resultado anterior %s", async checklist_hoje => {
    localStorage.setItem("metallo-frota-fila-10d:conta-teste", JSON.stringify([{ id: "pendente", veiculo: 1, nome: "Munck São José", criado: new Date().toISOString(), payload: { tipo: "checklist", local: "", obs: "", respostas: [] } }]));
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    try {
      render(<Frota acoes={acoes([caminhao({ checklist_hoje })])}/>);
      await screen.findByText("1 registro guardado no celular");
      expect(screen.queryByRole("button", { name: "Registrar saída" })).not.toBeInTheDocument();
      expect(screen.getByText(/Guardar no celular não libera/)).toBeInTheDocument();
    } finally { online.mockRestore(); }
  });
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
    expect(respostas[0]).toEqual({ versao: "a".repeat(64), nome: "Conferência 1", codigo: 1, situacao: "N", obs: "Freio com ruído", foto: "foto-do-defeito" });
    expect(respostas[25]).toEqual({ versao: "a".repeat(64), nome: "Conferência 26", codigo: 26, situacao: "NA", obs: "" });
    expect(chave).toMatch(/^[a-f0-9-]{36}$/);
    await screen.findByText(/Checklist registrado sem não conformidades/);
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

describe("Marco 10D: fluidez no app", () => {
  it("'Tudo conforme' marca só o que ainda não foi respondido na etapa", async () => {
    render(<Frota acoes={acoes()}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Fazer checklist" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Conferência 2" })).getByRole("button", { name: "Problema" }));
    fireEvent.click(screen.getByRole("button", { name: "Tudo conforme nesta etapa" }));
    expect(within(screen.getByRole("group", { name: "Conferência 1" })).getByRole("button", { name: "Conforme" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Conferência 2" })).getByRole("button", { name: "Problema" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Conferência 5" })).getByRole("button", { name: "Conforme" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Tudo conforme nesta etapa" })).not.toBeInTheDocument();
  });
  it("pede confirmação quando o km pula demais e mostra quanto rodou", async () => {
    const api = acoes([caminhao({ checklist_hoje: "liberado" })]);
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar saída" }));
    fireEvent.change(screen.getByLabelText("Para onde vai?"), { target: { value: "Obra Norte" } });
    fireEvent.change(screen.getByLabelText("Km do painel agora"), { target: { value: "10600" } });
    expect(screen.getByText("600 km desde a última leitura.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    expect(api.saida).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("toque de novo para confirmar");
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    await screen.findByText("Saída registrada. Boa viagem!");
    expect(api.saida).toHaveBeenCalledTimes(1);
  });
  it("sem internet guarda a saída no celular e envia sozinho quando o sinal volta", async () => {
    const api = { ...acoes([caminhao({ checklist_hoje: "liberado" })]), quem: "emp-1" };
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<Frota acoes={api}/>);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar saída" }));
    fireEvent.change(screen.getByLabelText("Para onde vai?"), { target: { value: "Obra Norte" } });
    fireEvent.change(screen.getByLabelText("Km do painel agora"), { target: { value: "10005" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar saída" }));
    await screen.findByText(/Sem internet: guardei no celular/);
    expect(api.saida).not.toHaveBeenCalled();
    expect(await screen.findByText("1 registro guardado no celular")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar saída" })).not.toBeInTheDocument();
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(api.saida).toHaveBeenCalledTimes(1));
    await screen.findByText(/Saída registrada\. Boa viagem!/);
    expect(screen.queryByText("1 registro guardado no celular")).not.toBeInTheDocument();
    online.mockRestore();
  });
});
