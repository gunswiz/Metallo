import { beforeEach, describe, expect, it, vi } from "vitest";
import { csvRelatorio10d, MES_RELATORIO_10D } from "@/03_FUNCOES_E_LOGICA/Frota/relatorio-10d";
import { ehFalhaDeConexao10d, guardarNaFila, lerFila, lerRecusadas, sincronizarFila, LIMITE_FILA_10D, type AcoesFila, type Pendente } from "@/03_FUNCOES_E_LOGICA/Frota/fila-offline-10d";

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

beforeEach(() => localStorage.clear());

describe("fila da frota sem internet (10D)", () => {
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
  it("erro de regra sai da fila e vira aviso para a pessoa, sem travar os próximos", async () => {
    const api = acoes();
    api.saida = vi.fn(async () => { throw new Error("veiculo_em_uso"); });
    guardarNaFila(quem, saida("s1", "2026-10-24T10:00:00Z"));
    guardarNaFila(quem, pend("c1", { tipo: "checklist", local: "", obs: "", respostas: [] }, "2026-10-24T10:02:00Z"));
    const r = await sincronizarFila(api, quem);
    expect(r.recusados).toHaveLength(1);
    expect(lerRecusadas(quem)[0].motivo).toBe("Este caminhão já está na rua.");
    expect(r.enviados).toHaveLength(1);
    expect(lerFila(quem)).toHaveLength(0);
  });
  it("reconhece falha de conexão e não confunde com erro de regra", () => {
    expect(ehFalhaDeConexao10d(new Error("SEM_CONEXAO"))).toBe(true);
    expect(ehFalhaDeConexao10d(new Error("Load failed"))).toBe(true);
    expect(ehFalhaDeConexao10d(new Error("veiculo_em_uso"))).toBe(false);
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
