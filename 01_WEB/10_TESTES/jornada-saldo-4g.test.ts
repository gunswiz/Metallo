import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { descreverJornada, JORNADA_PADRAO, minutosPrevistos, montarEspelho, saldoDoDia, saldoTexto } from "@/03_FUNCOES_E_LOGICA/Ponto/espelho-4e";

// Marco 4G: jornada da empresa (seg–qui 07–12/13–17; sex até 16h = 44 h) e saldo com a tolerância da CLT.
const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3));
const ev = (nsr: number, at: string) => ({ nsr, marking_at: new Date(at).toISOString() });
const agora = new Date("2026-10-20T20:00:00-03:00");

it("jornada padrão soma 44 horas por semana e é descrita em palavras", () => {
  expect(Object.values(JORNADA_PADRAO).reduce((t, h) => t + minutosPrevistos(h), 0)).toBe(44 * 60);
  expect(descreverJornada(JORNADA_PADRAO)).toBe("seg a qui 07:00–12:00 e 13:00–17:00; sex 07:00–12:00 e 13:00–16:00");
});

it("CLT art. 58 §1º: até 5 min por marcação e 10 no dia não contam", () => {
  const prev = JORNADA_PADRAO["1"];
  expect(saldoDoDia(["07:04", "12:00", "13:00", "17:03"].map(m), prev)).toEqual({ saldo: 0, tolerado: true });
  expect(saldoDoDia(["07:00", "12:00", "13:00", "17:00"].map(m), prev)).toEqual({ saldo: 0, tolerado: false });
});

it("passou da tolerância conta tudo (Súmula 366): 6 min de atraso = −6, não −1", () => {
  expect(saldoDoDia(["07:06", "12:00", "13:00", "17:00"].map(m), JORNADA_PADRAO["1"]).saldo).toBe(-6);
  // 4 + 4 + 4 = 12 min no dia: passou de 10, conta a diferença inteira (+8 −4 +... = 12 a mais).
  expect(saldoDoDia(["06:56", "12:04", "12:56", "17:00"].map(m), JORNADA_PADRAO["1"]).saldo).toBe(12);
});

it("sexta tem jornada de 8 h; sábado sem jornada vira 'trabalhou em dia sem jornada'", () => {
  const e = montarEspelho([ev(1, "2026-10-09T07:00:00-03:00"), ev(2, "2026-10-09T12:00:00-03:00"), ev(3, "2026-10-09T13:00:00-03:00"), ev(4, "2026-10-09T17:00:00-03:00"),
    ev(5, "2026-10-10T07:00:00-03:00"), ev(6, "2026-10-10T11:00:00-03:00")], "2026-10", agora);
  const sexta = e.dias.find(d => d.data === "2026-10-09")!, sabado = e.dias.find(d => d.data === "2026-10-10")!;
  expect(sexta.previsto).toBe(480);
  expect(sexta.saldo).toBe(60);
  expect(sexta.situacao).toBe("extra");
  expect(sabado.situacao).toBe("fora_jornada");
  expect(sabado.saldo).toBe(240);
});

it("dia útil passado sem marcação é sinalizado para conferir (não vira falta automática)", () => {
  const e = montarEspelho([], "2026-10", agora);
  expect(e.dias.find(d => d.data === "2026-10-19")!.situacao).toBe("sem_marcacao");
  expect(e.dias.find(d => d.data === "2026-10-18")!.situacao).toBe("folga");
  expect(e.dias.find(d => d.data === "2026-10-20")!.situacao).toBe("em_andamento");
  expect(e.totais.saldo).toBe(0);
  expect(saldoTexto(-75)).toBe("−1h15");
});

it("banco: jornada validada (pares em ordem, 7 dias) e só administrador altera", () => {
  const sql = readFileSync("../04_BANCO_E_SUPABASE/teste-online/4g-jornada-aej.sql", "utf8");
  expect(sql).toContain("check (private.jornada_valida_4g(dias))");
  expect(sql).toMatch(/admin_set_jornada_4g[\s\S]{0,200}is_active_admin/);
  expect(sql).toContain(`"5":["07:00","12:00","13:00","16:00"]`);
});

it("servidor: AEJ v002 só para administrador, campos separados por |, assinatura em .p7s", () => {
  const fn = readFileSync("../04_BANCO_E_SUPABASE/supabase/functions/ponto-4d/index.ts", "utf8");
  expect(fn).toMatch(/path === "\/gestao\/aej"[\s\S]{0,200}origin !== GESTAO[\s\S]{0,300}gestorAtivo\(tx, p\)/);
  expect(fn).toContain(`campos.map(campo).join("|")`);
  expect(fn).toContain(`"002"),`);
});
