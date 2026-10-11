import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { montarEspelho, JORNADA_PADRAO } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";
import { fotoDias4l, planilha4l, resumoHoras4l, situacaoFechamento4l } from "@/03_FUNCOES_E_LOGICA/Ponto/fechamento-4l";

// Marco 4L — fechamento do mês e relatório de horas extras/faltas.
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), capability: vi.fn(), redirect: vi.fn(), revalidate: vi.fn(), carregar: vi.fn(), fechamentos: vi.fn() }));
vi.mock("@/03_FUNCOES_E_LOGICA/Autenticacao/session", () => ({ requireCapability: mocks.capability }));
vi.mock("@/05_ACESSO_A_DADOS/Supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc }) }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/oficial-4f", () => ({ oficialLiberado4f: () => true }));
vi.mock("@/05_ACESSO_A_DADOS/Ponto/mes-4l", () => ({ carregarMes4l: mocks.carregar, lerFechamentos4l: mocks.fechamentos, lerPercentuais4l: async () => ({ extra: 60, domingo_feriado: 100 }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { fecharMes4l, fecharTodos4l, reabrirMes4l, salvarPercentuais4l } from "@/app/actions/fechamento-4l";

let nsr = 1;
const ev = (dia: string, hora: string) => ({ marking_at: `2026-09-${dia}T${String(Number(hora.slice(0, 2)) + 3).padStart(2, "0")}:${hora.slice(3)}:00.000Z`, nsr: nsr++ });
const eventos = [
  ...["07:00", "12:00", "13:00", "19:30"].map(h => ev("01", h)),           // terça: 2h30 a mais
  ...["07:30", "12:00", "13:00", "17:00"].map(h => ev("02", h)),           // quarta: 30 min de atraso
  ...["07:00", "11:00"].map(h => ev("05", h)),                             // sábado fora da jornada (4h: também passa de 2h extras no dia)
  ...["08:00", "10:00"].map(h => ev("06", h)),                             // domingo
  ...["08:00", "12:00"].map(h => ev("07", h)),                             // feriado
];
const espelho = montarEspelho(eventos, "2026-09", new Date("2026-10-05T12:00:00Z"), JORNADA_PADRAO,
  { feriados: { "2026-09-07": "Independência do Brasil" }, ocorrencias: { "2026-09-03": { tipo: "falta" }, "2026-09-04": { tipo: "atestado" } } });

describe("4L — relatório de horas", () => {
  it("separa extra, sábado, domingo/feriado, atrasos, faltas e abonos", () => {
    const r = resumoHoras4l(espelho);
    expect(r).toMatchObject({ marcacoes: 14, diasTrabalhados: 5, extra50: 150, sabado: 240, domingoFeriado: 360, atrasos: -30, faltas: 1, minutosFalta: -540, abonos: 1, diasAcima2h: 2 });
    expect(r.conferir).toBeGreaterThan(0);
  });
  it("foto tem todos os dias do mês, com horários e observação", () => {
    const foto = fotoDias4l(espelho);
    expect(foto).toHaveLength(30);
    expect(foto[0]).toMatchObject({ d: "2026-09-01", h: ["07:00", "12:00", "13:00", "19:30"], b: 150 });
    expect(foto[6].o).toContain("Independência");
  });
  it("planilha: abre no Excel, protege contra fórmula e não estraga hora negativa", () => {
    const csv = planilha4l("2026-09", [{ nome: "=HYPERLINK(\"x\")", matricula: "A;1", resumo: resumoHoras4l(espelho), situacao: "esperando" }]);
    expect(csv.startsWith("﻿Mes;Funcionario;")).toBe(true);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).toContain("\"A;1\"");
    expect(csv).toContain(";-0:30;");
    expect(csv).toContain(";2:30;4:00;6:00;");
    expect(csv).toContain("Extra dia de trabalho (60%);Sabado fora da jornada (60%);Domingo/feriado trabalhado (100%)");
    expect(planilha4l("2026-09", [], { extra: 75, domingo_feriado: 100 })).toContain("Extra dia de trabalho (75%)");
  });
  it("situação do fechamento", () => {
    expect(situacaoFechamento4l(undefined)).toBe("aberto");
    expect(situacaoFechamento4l({ resposta: null })).toBe("esperando");
    expect(situacaoFechamento4l({ resposta: "confirmado" })).toBe("confirmado");
    expect(situacaoFechamento4l({ resposta: "confirmado", mudou: true })).toBe("mudou");
  });
});

const form = (f: Record<string, string>) => { const d = new FormData(); for (const [k, v] of Object.entries(f)) d.set(k, v); return d; };
const joao = "9d5eb6bc-eab7-42cb-964c-911187206b93", maria = "a0000000-0000-4000-8000-000000000002";
const semPendencia = montarEspelho([], "2026-09", new Date("2026-10-05T12:00:00Z"), { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [] });
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
  mocks.redirect.mockImplementation((url: string) => { throw new Error(`redirect:${url}`); });
  mocks.carregar.mockResolvedValue({ erro: false, jornada: JORNADA_PADRAO, pessoas: [{ employee_id: joao, nome: "João", matricula: null, espelho }, { employee_id: maria, nome: "Maria", matricula: null, espelho: semPendencia }] });
});
afterEach(() => { vi.useRealTimers(); });

describe("4L — fechar e reabrir", () => {
  it("com dia para conferir, só fecha marcando “Fechar mesmo assim”", async () => {
    await expect(fecharMes4l(form({ mes: "2026-09", employeeId: joao }))).rejects.toThrow("redirect:/ponto-laboratorio/fechamento?mes=2026-09&erro=conferir");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(fecharMes4l(form({ mes: "2026-09", employeeId: joao, mesmoAssim: "1" }))).rejects.toThrow("ok=fechado");
    const [nome, args] = mocks.rpc.mock.calls[0];
    expect(nome).toBe("admin_fechar_mes_4l");
    expect(args).toMatchObject({ p_employee_id: joao, p_mes: "2026-09", p_resumo: { marcacoes: 14, extra50: 150 } });
    expect(args.p_dias).toHaveLength(30);
    expect(mocks.capability).toHaveBeenCalledWith("admin:manage");
  });
  it("mês que não terminou não fecha", async () => {
    await expect(fecharMes4l(form({ mes: "2026-10", employeeId: joao }))).rejects.toThrow("erro=nao-terminou");
    expect(mocks.carregar).not.toHaveBeenCalled();
  });
  it.each([["mes_ja_fechado", "ja-fechado"], ["resumo_desatualizado", "desatualizado"], ["x", "falhou"]])("erro %s → %s", async (erro, codigo) => {
    mocks.rpc.mockResolvedValue({ error: { message: erro } });
    await expect(fecharMes4l(form({ mes: "2026-09", employeeId: maria }))).rejects.toThrow(`erro=${codigo}`);
  });
  it("fechar todos pula quem tem pendência e quem já está fechado", async () => {
    mocks.fechamentos.mockResolvedValue([]);
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(fecharTodos4l(form({ mes: "2026-09" }))).rejects.toThrow("ok=todos&feitos=1&pulados=1");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1].p_employee_id).toBe(maria);
    mocks.rpc.mockClear();
    mocks.fechamentos.mockResolvedValue([{ employee_id: maria }]);
    await expect(fecharTodos4l(form({ mes: "2026-09" }))).rejects.toThrow("feitos=0&pulados=1");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("percentuais: abaixo do mínimo da lei é recusado; 60% salva", async () => {
    await expect(salvarPercentuais4l(form({ mes: "2026-09", extra: "40", domingo: "100" }))).rejects.toThrow("erro=percentual");
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(salvarPercentuais4l(form({ mes: "2026-09", extra: "60", domingo: "100" }))).rejects.toThrow("ok=percentuais");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_set_percentuais_dp_4l", { p_extra: 60, p_domingo_feriado: 100 });
  });
  it("reabrir exige motivo", async () => {
    await expect(reabrirMes4l(form({ mes: "2026-09", fechamentoId: "3", motivo: "ok" }))).rejects.toThrow("erro=motivo");
    mocks.rpc.mockResolvedValue({ error: null });
    await expect(reabrirMes4l(form({ mes: "2026-09", fechamentoId: "3", motivo: "Faltou lançar atestado" }))).rejects.toThrow("ok=reaberto");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_reabrir_mes_4l", { p_id: 3, p_motivo: "Faltou lançar atestado" });
  });
});

describe("4L — banco e app", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4l-fechamento-mes.sql", "utf8");
  it("SQL: mês fechado trava ocorrência e feriado; só admin fecha; funcionário responde só o dele", () => {
    expect(sql).toMatch(/create or replace trigger trava_mes_fechado_4l before insert or update on private\.ocorrencias_ponto_4h/);
    expect(sql).toMatch(/create or replace trigger trava_mes_fechado_4l before insert or update on private\.feriados_4h/);
    expect(sql).toMatch(/admin_fechar_mes_4l[\s\S]{0,300}is_active_admin/);
    expect(sql).toContain("resumo_desatualizado");
    expect(sql).toMatch(/where id = p_id and employee_id = v_emp and reaberto_em is null and resposta is null/);
    expect(sql).not.toMatch(/^\s*(drop|delete|truncate)\b/im);
  });
  it("app: as duas chamadas novas estão liberadas na lista do portalFetch", () => {
    const local = readFileSync("05_ACESSO_A_DADOS/Supabase/colaborador-local.ts", "utf8");
    expect(local).toContain("\"/rest/v1/rpc/my_fechamentos_4l\"");
    expect(local).toContain("\"/rest/v1/rpc/responder_fechamento_4l\"");
  });
});
