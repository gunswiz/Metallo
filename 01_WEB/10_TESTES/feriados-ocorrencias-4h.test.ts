import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { intervaloDoMes, montarEspelho, textoDoDia } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";

// Marco 4H: feriados e ocorrências (tratamento) no espelho. As marcações originais não mudam.
const agora = new Date("2026-10-20T20:00:00-03:00");
const ev = (nsr: number, at: string) => ({ nsr, marking_at: new Date(at).toISOString() });

it("feriado nacional não tem jornada nem vira 'sem marcação'", () => {
  const e = montarEspelho([], "2026-10", agora, undefined, { feriados: { "2026-10-12": "Nossa Senhora Aparecida" } });
  const dia = e.dias.find(d => d.data === "2026-10-12")!;
  expect(dia.situacao).toBe("feriado");
  expect(dia.previsto).toBe(0);
  expect(textoDoDia(dia)).toBe("Feriado: Nossa Senhora Aparecida");
});

it("trabalhar no feriado conta as horas feitas", () => {
  const e = montarEspelho([ev(1, "2026-10-12T07:00:00-03:00"), ev(2, "2026-10-12T11:00:00-03:00")], "2026-10", agora, undefined, { feriados: { "2026-10-12": "Aparecida" } });
  const dia = e.dias.find(d => d.data === "2026-10-12")!;
  expect(dia.situacao).toBe("feriado_trabalhado");
  expect(dia.saldo).toBe(240);
});

it("atestado e férias abonam o dia; falta não justificada desconta a jornada", () => {
  const e = montarEspelho([], "2026-10", agora, undefined, { ocorrencias: { "2026-10-05": { tipo: "atestado", id: 1 }, "2026-10-06": { tipo: "ferias" }, "2026-10-07": { tipo: "falta" }, "2026-10-09": { tipo: "falta" } } });
  expect(e.dias.find(d => d.data === "2026-10-05")!.situacao).toBe("abonado");
  expect(e.dias.find(d => d.data === "2026-10-05")!.saldo).toBe(0);
  expect(e.dias.find(d => d.data === "2026-10-07")!.saldo).toBe(-540);
  expect(e.dias.find(d => d.data === "2026-10-09")!.saldo).toBe(-480); // sexta
  expect(textoDoDia(e.dias.find(d => d.data === "2026-10-06")!)).toBe("Férias");
  expect(e.totais).toMatchObject({ faltas: 2, abonos: 2 });
  expect(e.totais.diasSemMarcacao).toBe(e.dias.filter(d => d.situacao === "sem_marcacao").length);
});

it("intervalo do mês", () => {
  expect(intervaloDoMes("2026-02")).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
});

it("banco: ocorrência é cancelada, nunca apagada; feriado é desativado; só administrador grava; funcionário vê só as dele", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4h-feriados-ocorrencias.sql", "utf8");
  expect(sql).not.toMatch(/delete from private\./);
  expect(sql).toMatch(/admin_set_ocorrencia_4h[\s\S]{0,300}is_active_admin/);
  expect(sql).toMatch(/my_ocorrencias_4h[\s\S]{0,800}i\.auth_user_id = \(select auth\.uid\(\)\)/);
  expect(sql).toContain("('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional')");
});
