import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { csvRelatorio10d, MES_RELATORIO_10D } from "@/03_FUNCOES_E_LOGICA/Frota/relatorio-10d";
import { guardarFotoLocal, anotarRecusa, guardarConferenciaRecusa, recusaBloqueiaSaida } from "@/03_FUNCOES_E_LOGICA/Frota/fila-offline-10d";
import { ehFalhaDeConexao10d, enviarSemFotosPendentes, executarPendente, guardarNaFila, lerCache, lerFila, lerRecusadas, limparRecusadas, sincronizarFila, LIMITE_FILA_10D, type AcoesFila, type Pendente } from "@/03_FUNCOES_E_LOGICA/Frota/fila-offline-10d";

const quem = "emp-1";
const pend = (id: string, payload: Pendente["payload"], criado: string): Pendente => ({ id, veiculo: 1, nome: "Munck 01", criado, payload });
const saida = (id: string, criado: string) => pend(id, { tipo: "saida", destino: "Obra", acompanhantes: "", km: 100, obs: "" }, criado);
const acoes = (): AcoesFila & { ordem: string[] } => {
  const ordem: string[] = [];
  return { ordem,
    checklist: vi.fn(async (_v, _l, _o, _r, chave: string) => { ordem.push("checklist:" + chave); return "liberado" as const; }),
    saida: vi.fn(async (_v, _d, _a, _k, _o, chave: string) => { ordem.push("saida:" + chave); }),
    foto: vi.fn(async () => "foto-real"), chegada: vi.fn(async () => true) };
};

function transacaoFoto(loja: object, concluir = true) {
  const transacao = {
    objectStore: () => loja,
    oncomplete: null as (() => void) | null,
    onabort: null as (() => void) | null
  };
  queueMicrotask(() => concluir ? transacao.oncomplete?.() : transacao.onabort?.());
  return transacao;
}

beforeEach(() => localStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("fila da frota sem internet (10D)", () => {
  it("conferência específica do servidor encerra a pendência sem reenviar defeito", () => {
    const registro = pend("original", { tipo: "checklist", local: "Obra", obs: "Antigo", respostas: [{ codigo: 1, situacao: "N", obs: "Freio" }] }, "2026-11-01T10:00:00Z");
    anotarRecusa(quem, { id: registro.id, nome: registro.nome, tipo: "checklist", motivo: "Itens mudaram", registro });
    const prova = { chave: registro.id, veiculo: 1, relato: registro.payload, recebido_em: "2026-11-02T10:00:00Z", conferido_em: null, motivo: null };
    expect(guardarConferenciaRecusa(quem, prova)).toBe(true);
    expect(recusaBloqueiaSaida(lerRecusadas(quem)[0])).toBe(true);
    const confirmada = { ...prova, conferido_em: "2026-11-02T11:00:00Z", motivo: "Conserto conferido" };
    expect(guardarConferenciaRecusa("outra-conta", confirmada)).toBe(false);
    expect(guardarConferenciaRecusa(quem, { ...confirmada, veiculo: 2 })).toBe(false);
    expect(guardarConferenciaRecusa(quem, { ...confirmada, relato: { ...registro.payload, obs: "Outro relato" } })).toBe(false);
    expect(recusaBloqueiaSaida(lerRecusadas(quem)[0])).toBe(true);
    expect(guardarConferenciaRecusa(quem, confirmada)).toBe(true);
    expect(recusaBloqueiaSaida(lerRecusadas(quem)[0])).toBe(false);
    expect(lerRecusadas(quem)[0].registro).toEqual(registro);
  });
  it("falha ao guardar a conferência mantém o bloqueio", () => {
    const registro = pend("original", { tipo: "chegada", viagem: 1, km: 100, obs: "", problema: "Freio" }, "2026-11-01T10:00:00Z");
    anotarRecusa(quem, { id: registro.id, nome: registro.nome, tipo: "chegada", motivo: "Recusado", registro });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    expect(guardarConferenciaRecusa(quem, { chave: registro.id, veiculo: 1, relato: registro.payload, recebido_em: "2026-11-02T10:00:00Z", conferido_em: "2026-11-02T11:00:00Z", motivo: "Resolvido" })).toBe(false);
    expect(recusaBloqueiaSaida(lerRecusadas(quem)[0])).toBe(true);
  });
  it("novo checklist aceito com o mesmo defeito supera a recusa sem apagar o relato", async () => {
    const api = acoes();
    const payload: Pendente["payload"] = { tipo: "checklist", local: "Obra", obs: "Original", respostas: [{ codigo: 1, situacao: "N", obs: "Freio com vazamento", versao: "a".repeat(64) }] };
    guardarNaFila(quem, pend("recusado", payload, "2026-11-01T10:00:00Z"));
    api.checklist = vi.fn().mockRejectedValueOnce({ message: "itens_incompletos" }).mockResolvedValue("nao_liberado");
    await sincronizarFila(api, quem);
    // Um novo relato diferente não comprova recebimento do defeito antigo.
    await executarPendente(api, quem, pend("outro", { ...payload, respostas: [{ codigo: 2, situacao: "N", obs: "Lâmpada" }] }, "2026-11-01T10:01:00Z"), true);
    expect(lerRecusadas(quem)[0].recebidoEmRegistro).toBeUndefined();
    await executarPendente(api, quem, pend("outra-versao", { ...payload, respostas: payload.respostas.map(x => ({ ...x, versao: "b".repeat(64) })) }, "2026-11-01T10:01:30Z"), true);
    expect(lerRecusadas(quem)[0].recebidoEmRegistro).toBeUndefined();
    await executarPendente(api, quem, pend("aceito", payload, "2026-11-01T10:02:00Z"), true);
    expect(lerRecusadas(quem)[0]).toMatchObject({ recebidoEmRegistro: "aceito", registro: { payload } });
    // Só a trava local é retirada; o servidor continua decidindo a disponibilidade.
    api.saida = vi.fn().mockRejectedValue(new Error("veiculo_nao_liberado"));
    await expect(executarPendente(api, quem, saida("s1", "2026-11-01T10:03:00Z"))).rejects.toThrow("veiculo_nao_liberado");
    expect(api.saida).toHaveBeenCalledTimes(1);
  });
  it("recusa versão antiga sem perder relato e não reconhece legado sem versão pelo mesmo código", async () => {
    const api = acoes();
    const payload: Pendente["payload"] = { tipo: "checklist", local: "", obs: "", respostas: [{ codigo: 1, situacao: "N", obs: "Freio" }] };
    guardarNaFila(quem, pend("antigo", payload, "2026-11-01T10:00:00Z"));
    api.checklist = vi.fn().mockRejectedValueOnce(new Error("checklist_versao_desatualizada")).mockResolvedValue("nao_liberado");
    const result = await sincronizarFila(api, quem);
    expect(result.recusados).toHaveLength(1);
    expect(lerRecusadas(quem)[0].registro?.payload).toEqual(payload);
    await executarPendente(api, quem, pend("novo", payload, "2026-11-01T10:01:00Z"), true);
    expect(recusaBloqueiaSaida(lerRecusadas(quem)[0])).toBe(true);
  });
  it("informa sincronização em andamento sem executar duas vezes", async () => {
    const api = acoes();
    let concluir!: () => void;
    api.saida = vi.fn(() => new Promise<void>(resolve => { concluir = resolve; }));
    guardarNaFila(quem, saida("unica", "2026-11-01T10:00:00Z"));
    const primeira = sincronizarFila(api, quem);
    await Promise.resolve(); await Promise.resolve();
    expect((await sincronizarFila(api, quem, true)).emAndamento).toBe(true);
    concluir(); await primeira;
    expect(api.saida).toHaveBeenCalledTimes(1);
  });
  it("objeto de erro RPC preserva relato recusado e impede saída após ciência", async () => {
    const api = acoes();
    api.checklist = vi.fn().mockRejectedValue({ code: "P0001", message: "itens_incompletos", details: null, hint: null });
    const registro = pend("critico", { tipo: "checklist", local: "Obra", obs: "", respostas: [{ codigo: 1, situacao: "N", obs: "Freio com defeito" }] }, "2026-11-01T10:00:00Z");
    guardarNaFila(quem, registro);
    await sincronizarFila(api, quem);
    expect(lerRecusadas(quem)[0].registro).toEqual(registro);
    expect(limparRecusadas(quem)).toBe(true);
    expect(lerRecusadas(quem)[0].registro).toEqual(registro);
    await expect(executarPendente(api, quem, saida("s1", "2026-11-01T10:02:00Z"))).rejects.toThrow("registro_pendente");
    expect(api.saida).not.toHaveBeenCalled();
    expect(ehFalhaDeConexao10d({ message: "TypeError: Failed to fetch", code: "", details: "", hint: "" })).toBe(true);
    expect(ehFalhaDeConexao10d({ message: "transaction aborted" })).toBe(false);
  });
  it("formulário corrigido substitui payload e reutiliza foto já enviada", async () => {
    const api = acoes();
    const foto = "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4";
    const registro = pend("corrigido", { tipo: "chegada", viagem: 1, km: 90, problema: "Freio", obs: "", foto }, "2026-11-01T10:00:00Z");
    guardarNaFila(quem, { ...registro, payload: { ...registro.payload, foto: "remota" } as Pendente["payload"], fotosEnviadas: { [foto]: "remota" }, fotosLocais: [foto], revisar: true });
    const corrigido = { ...registro, payload: { ...registro.payload, km: 120 } as Pendente["payload"] };
    await executarPendente(api, quem, corrigido, true);
    expect(api.chegada).toHaveBeenCalledWith(1, 120, "Freio", "", "corrigido", "remota", 1);
    expect(api.foto).not.toHaveBeenCalled();
    expect(lerFila(quem)).toEqual([]);
  });
  it("foto ausente no formulário marca revisão imediatamente e não envia depois sozinho", async () => {
    const api = acoes();
    const registro = pend("direto", { tipo: "chegada", viagem: 1, km: 100, problema: "Vazamento", obs: "", foto: "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4" }, "2026-11-01T10:00:00Z");
    await expect(executarPendente(api, quem, registro, true)).rejects.toThrow("foto_pendente");
    expect(lerFila(quem)[0]).toMatchObject({ revisar: true, fotoPendente: true });
    await sincronizarFila(api, quem);
    expect(api.chegada).not.toHaveBeenCalled();
  });
  it.each([true, false])("só confirma a foto quando a gravação termina (concluída=%s)", async concluir => {
    const put = vi.fn(() => ({ result: "chave gravada" }));
    const banco = { close: vi.fn(), transaction: () => transacaoFoto({ put }, concluir) };
    vi.stubGlobal("indexedDB", { open: () => {
      const pedido = { result: banco, onsuccess: null as (() => void) | null };
      queueMicrotask(() => pedido.onsuccess?.());
      return pedido;
    } });
    const id = await guardarFotoLocal(quem, 1, new Blob(["foto"]));
    expect(put).toHaveBeenCalledOnce();
    if (concluir) expect(id).toMatch(/^local:/);
    else expect(id).toBeNull();
    expect(banco.close).toHaveBeenCalledOnce();
  });
  it("persiste cada foto enviada e limpa os originais somente após confirmar o relato", async () => {
    const a = "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4", b = "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e5";
    const request = (result: unknown) => {
      const pending: { result: unknown; onsuccess?: () => void } = { result };
      queueMicrotask(() => pending.onsuccess?.()); return pending;
    };
    const apagar = vi.fn(() => request(undefined));
    vi.stubGlobal("indexedDB", { open: () => request({ close: vi.fn(), transaction: () => transacaoFoto({ get: (id: string) => request(id === JSON.stringify([quem, 1, a]) ? { id, blob: new Blob(["sintética"]) } : undefined), delete: apagar }) }) });
    const { lerFotoLocal } = await import("../03_FUNCOES_E_LOGICA/Frota/fila-offline-10d");
    expect(await lerFotoLocal("outra-conta", 1, a)).toBeNull();
    expect(await lerFotoLocal(quem, 2, a)).toBeNull();
    const api = acoes();
    guardarNaFila(quem, pend("duas-fotos", { tipo: "checklist", local: "", obs: "", respostas: [{ codigo: 1, situacao: "N", obs: "Defeito A", foto: a }, { codigo: 2, situacao: "N", obs: "Defeito B", foto: b }] }, "2026-11-01T10:00:00Z"));
    await sincronizarFila(api, quem);
    await sincronizarFila(api, quem, true);
    expect(api.foto).toHaveBeenCalledTimes(1);
    expect(apagar).not.toHaveBeenCalled();
    expect(lerFila(quem)[0].fotosLocais).toContain(a);
    expect(enviarSemFotosPendentes(quem, "duas-fotos")).toBe(true);
    await sincronizarFila(api, quem, true);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.checklist).toHaveBeenCalledWith(1, "", expect.any(String), [{ codigo: 1, situacao: "N", obs: "Defeito A", foto: "foto-real" }, { codigo: 2, situacao: "N", obs: "Defeito B" }], "duas-fotos");
    expect(apagar).toHaveBeenCalledWith(JSON.stringify([quem, 1, a]));
    expect(apagar).toHaveBeenCalledWith(JSON.stringify([quem, 1, b]));
  });
  it("foto recusada não é descartada nem permite confirmar a operação", async () => {
    const foto = "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4";
    const request = (result: unknown) => {
      const pending: { result: unknown; onsuccess?: () => void } = { result };
      queueMicrotask(() => pending.onsuccess?.());
      return pending;
    };
    const arquivo = new Blob(["imagem sintética"], { type: "image/jpeg" });
    const apagar = vi.fn();
    vi.stubGlobal("indexedDB", { open: () => request({ close: vi.fn(), transaction: () => transacaoFoto({ get: () => request({ id: foto, blob: arquivo }), delete: apagar }) }) });
    const api = acoes();
    api.foto = vi.fn(async () => { throw new Error("file_not_allowed"); });
    const registro = pend("rejeitada", { tipo: "chegada", viagem: 1, km: 101, problema: "Vazamento", obs: "", foto }, "2026-11-01T10:00:00Z");
    guardarNaFila(quem, registro);
    const result = await sincronizarFila(api, quem);
    expect(api.foto).toHaveBeenCalledWith(1, arquivo);
    expect(api.chegada).not.toHaveBeenCalled();
    expect(apagar).not.toHaveBeenCalled();
    expect(result.impedimento).toContain("não foi aceita");
    expect(lerFila(quem)).toEqual([{ ...registro, fotoPendente: true, revisar: true }]);
  });
  it.each(["checklist", "chegada"] as const)("preserva %s e interrompe a fila quando a foto local não está disponível", async tipo => {
    const api = acoes();
    const foto = "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4";
    const payload: Pendente["payload"] = tipo === "checklist"
      ? { tipo, local: "Obra", obs: "", respostas: [{ codigo: 1, situacao: "N", obs: "Vazamento", foto }] }
      : { tipo, viagem: 1, km: 101, problema: "Vazamento", obs: "", foto };
    guardarNaFila(quem, pend("foto-pendente", payload, "2026-11-01T10:00:00Z"));
    guardarNaFila(quem, saida("posterior", "2026-11-01T10:01:00Z"));
    const result = await sincronizarFila(api, quem);
    expect(result.impedimento).toContain("foto está indisponível");
    expect(result.restam).toBe(2);
    expect(lerFila(quem)[0].payload).toEqual(payload);
    expect(lerRecusadas(quem)).toHaveLength(0);
    expect(api.checklist).not.toHaveBeenCalled();
    expect(api.chegada).not.toHaveBeenCalled();
    expect(api.saida).not.toHaveBeenCalled();
  });
  it("guarda por funcionário, sem duplicar a mesma chave, e respeita o limite", () => {
    expect(guardarNaFila(quem, saida("a", "2026-10-24T10:00:00Z"))).toBe(true);
    expect(guardarNaFila(quem, saida("a", "2026-10-24T10:00:00Z"))).toBe(true);
    expect(lerFila(quem)).toHaveLength(1);
    expect(lerFila("outra-pessoa")).toHaveLength(0);
    for (let i = 0; i < LIMITE_FILA_10D; i++) guardarNaFila(quem, saida("x" + i, "2026-10-24T11:00:00Z"));
    expect(guardarNaFila(quem, saida("estoura", "2026-10-24T12:00:00Z"))).toBe(false);
  });
  it("envia na ordem em que foram feitos e esvazia a fila", async () => {
    const api = acoes();
    guardarNaFila(quem, saida("s1", "2026-10-24T10:05:00Z"));
    guardarNaFila(quem, pend("c1", { tipo: "checklist", local: "", obs: "", respostas: [] }, "2026-10-24T10:00:00Z"));
    const r = await sincronizarFila(api, quem);
    expect(api.ordem).toEqual(["checklist:c1", "saida:s1"]);
    expect(r.enviados).toHaveLength(2);
    expect(r.restam).toBe(0);
  });
  it("para na falta de sinal e mantém o que não foi enviado", async () => {
    const api = acoes();
    api.saida = vi.fn(async () => { throw new Error("Failed to fetch"); });
    guardarNaFila(quem, saida("s1", "2026-10-24T10:00:00Z"));
    guardarNaFila(quem, saida("s2", "2026-10-24T10:01:00Z"));
    const r = await sincronizarFila(api, quem);
    expect(api.saida).toHaveBeenCalledTimes(1);
    expect(r.restam).toBe(2);
    expect(lerRecusadas(quem)).toHaveLength(0);
  });
  it("erro de regra guarda conteúdo recusado sem travar outro veículo", async () => {
    const api = acoes();
    api.saida = vi.fn(async () => { throw new Error("veiculo_em_uso"); });
    guardarNaFila(quem, saida("s1", "2026-10-24T10:00:00Z"));
    guardarNaFila(quem, { ...pend("c1", { tipo: "checklist", local: "", obs: "", respostas: [] }, "2026-10-24T10:02:00Z"), veiculo: 2 });
    const r = await sincronizarFila(api, quem);
    expect(r.recusados).toHaveLength(1);
    expect(lerRecusadas(quem)[0].motivo).toBe("Este veículo já está na rua.");
    expect(lerRecusadas(quem)[0].registro?.payload.tipo).toBe("saida");
    expect(r.enviados).toHaveLength(1);
    expect(lerFila(quem)).toHaveLength(0);
  });
  it("reconhece falha de conexão e não confunde com erro de regra", () => {
    expect(ehFalhaDeConexao10d(new Error("SEM_CONEXAO"))).toBe(true);
    expect(ehFalhaDeConexao10d(new Error("Load failed"))).toBe(true);
    expect(ehFalhaDeConexao10d(new Error("veiculo_em_uso"))).toBe(false);
    expect(ehFalhaDeConexao10d(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(ehFalhaDeConexao10d(new TypeError("Failed to fetch"))).toBe(true);
    expect(ehFalhaDeConexao10d(new Error("statement timeout"))).toBe(false);
    expect(ehFalhaDeConexao10d(new Error("transaction aborted"))).toBe(false);
  });
  it.each(["401", "429", "500", "JWT expired", "statement timeout"])("preserva erro desconhecido %s e só repete por decisão manual", async erro => {
    const api = acoes();
    api.saida = vi.fn().mockRejectedValue(new Error(erro));
    const registro = saida("retido", "2026-11-01T10:00:00Z");
    guardarNaFila(quem, registro);
    await sincronizarFila(api, quem);
    await sincronizarFila(api, quem);
    expect(api.saida).toHaveBeenCalledTimes(1);
    expect(lerFila(quem)[0].payload).toEqual(registro.payload);
    expect(lerRecusadas(quem)).toEqual([]);
    await sincronizarFila(api, quem, true);
    expect(api.saida).toHaveBeenCalledTimes(2);
  });
  it("foto ausente não bloqueia outro veículo e decisão explícita mantém o defeito", async () => {
    const api = acoes();
    const registro = pend("critico", { tipo: "checklist", local: "Obra", obs: "Inspeção", respostas: [{ codigo: 1, situacao: "N", obs: "Freio quebrado", foto: "local:731cb0c4-c5ea-4fad-ab2e-fc632fdd39e4" }] }, "2026-11-01T10:00:00Z");
    guardarNaFila(quem, registro);
    guardarNaFila(quem, { ...saida("outro", "2026-11-01T10:01:00Z"), veiculo: 2 });
    await sincronizarFila(api, quem);
    expect(api.saida).toHaveBeenCalledTimes(1);
    expect(enviarSemFotosPendentes(quem, "critico")).toBe(true);
    await sincronizarFila(api, quem, true);
    expect(api.checklist).toHaveBeenCalledWith(1, "Obra", expect.stringContaining("por decisão do funcionário"), [{ codigo: 1, situacao: "N", obs: "Freio quebrado" }], "critico");
    expect(lerFila(quem)).toEqual([]);
  });
  it("não perde o registro se o armazenamento da recusa falha", async () => {
    const api = acoes();
    api.saida = vi.fn().mockRejectedValue(new Error("veiculo_em_uso"));
    guardarNaFila(quem, saida("retido", "2026-11-01T10:00:00Z"));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    await sincronizarFila(api, quem);
    expect(lerFila(quem)).toHaveLength(1);
  });
  it("retira liberação de ontem e rejeita cache antigo ou inválido", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T11:00:00Z"));
    const chave = `metallo-frota-cache-10d:${quem}`;
    const cache = { em: "2026-10-31T22:00:00Z", caminhoes: [{ id: 1, checklist_hoje: "liberado" }], itens: [], viagens: [] };
    localStorage.setItem(chave, JSON.stringify(cache));
    expect(lerCache(quem)?.caminhoes[0].checklist_hoje).toBeNull();
    for (const em of ["2026-10-30T10:00:00Z", "inválido", "2026-11-02T10:00:00Z"]) {
      localStorage.setItem(chave, JSON.stringify({ ...cache, em }));
      expect(lerCache(quem)).toBeNull();
    }
  });
});

describe("relatório do mês em CSV (10D)", () => {
  it("usa ';', acentos, vírgula decimal, total e protege contra fórmula no Excel", () => {
    const csv = csvRelatorio10d([{ veiculo_id: 1, nome: "=Munck 01", placa: "ABC1D23", saidas: 3, km_rodados: 120, checklists: 5, itens_com_problema: 1, defeitos_abertos: 1, manutencoes_concluidas: 1, dias_parado: 2, custo: 1234.5 }]);
    expect(csv.startsWith("﻿Caminhão;Placa;Saídas;")).toBe(true);
    expect(csv).toContain("'=Munck 01;ABC1D23;3;120;5;1;1;1;2;1.234,50");
    expect(csv).toContain("Total;;3;120;5;1;1;1;2;1.234,50");
    expect(MES_RELATORIO_10D.test("2026-10")).toBe(true);
    expect(MES_RELATORIO_10D.test("2026-13")).toBe(false);
  });
});
