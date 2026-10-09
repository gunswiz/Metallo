import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { espelhosPorFuncionario, horasMinutos, mesAnterior, mesSeguinte, mesValido, montarEspelho, nomeDoMes, respostaEspelho } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";

// Marco 4E — espelho de ponto: só organiza as marcações originais; não altera nem inventa horários.
const ev = (nsr: number, at: string, emp = "a0000000-0000-4000-8000-000000000001", nome = "João Teste") => ({
  event_id: `e0000000-0000-4000-8000-${String(nsr).padStart(12, "0")}`, nsr, employee_id: emp, employee_name: nome, employee_code: "M1",
  marking_at: new Date(at).toISOString(), recorded_at: new Date(at).toISOString() });
const agora = new Date("2026-10-20T15:00:00Z");

it("pares entrada→saída somam as horas do dia (fuso de Fortaleza)", () => {
  const e = montarEspelho([ev(1, "2026-10-05T07:00:00-03:00"), ev(2, "2026-10-05T11:00:30-03:00"), ev(3, "2026-10-05T12:00:00-03:00"), ev(4, "2026-10-05T17:05:00-03:00")], "2026-10", agora);
  const dia = e.dias.find(d => d.data === "2026-10-05")!;
  expect(dia.horarios).toEqual(["07:00", "11:00", "12:00", "17:05"]);
  expect(dia.minutos).toBe(4 * 60 + 5 * 60 + 5);
  expect(dia.impar).toBe(false);
  expect(dia.diaSemana).toBe("seg");
  expect(e.totais).toMatchObject({ marcacoes: 4, diasComMarcacao: 1, minutos: 545, diasImpares: 0 });
  expect(e.dias).toHaveLength(31);
});

it("marcação às 22h de Fortaleza conta no dia certo, não no dia seguinte (UTC)", () => {
  const e = montarEspelho([ev(1, "2026-10-06T22:00:00-03:00")], "2026-10", agora);
  expect(e.dias.find(d => d.data === "2026-10-06")!.horarios).toEqual(["22:00"]);
  expect(e.dias.find(d => d.data === "2026-10-07")!.horarios).toEqual([]);
});

it("dia com número ímpar avisa 'falta marcar' (menos hoje, que ainda está em andamento)", () => {
  const e = montarEspelho([ev(1, "2026-10-07T07:00:00-03:00"), ev(2, "2026-10-20T07:00:00-03:00")], "2026-10", new Date("2026-10-20T12:00:00-03:00"));
  expect(e.dias.find(d => d.data === "2026-10-07")!.impar).toBe(true);
  expect(e.totais.diasImpares).toBe(1);
  expect(e.dias.find(d => d.data === "2026-10-21")!.futuro).toBe(true);
});

it("agrupa por funcionário e ordena por nome", () => {
  const r = espelhosPorFuncionario([ev(1, "2026-10-05T07:00:00-03:00", "a0000000-0000-4000-8000-000000000002", "Maria"), ev(2, "2026-10-05T07:00:00-03:00")], "2026-10", agora);
  expect(r.map(p => p.nome)).toEqual(["João Teste", "Maria"]);
});

it("utilitários de mês e horas", () => {
  expect(horasMinutos(485)).toBe("8h05");
  expect(mesAnterior("2026-01")).toBe("2025-12");
  expect(mesSeguinte("2026-12")).toBe("2027-01");
  expect(mesValido("2026-13")).toBe(false);
  expect(mesValido("2026-10")).toBe(true);
  expect(nomeDoMes("2026-10")).toBe("Outubro de 2026");
});

it("resposta do servidor é validada (campos extras são recusados)", () => {
  expect(() => respostaEspelho.parse({ events: [{ ...ev(1, "2026-10-05T07:00:00-03:00"), location: {} }], window: { start: "2026-10-01T03:00:00.000Z", end: "2026-11-01T03:00:00.000Z" } })).toThrow();
});

it("servidor: espelho da Gestão só para administrador com sessão ativa; o do app só da própria pessoa", () => {
  const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts", "utf8");
  expect(fn).toMatch(/path === "\/gestao\/espelho"[\s\S]{0,200}origin !== GESTAO[\s\S]{0,300}gestorAtivo\(tx, p\)/);
  expect(fn).toMatch(/path === "\/v4b\/espelho"[\s\S]{0,120}pessoal\(p,[\s\S]{0,200}auth_user_id=\$1/);
});
