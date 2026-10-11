import { z } from "zod";
import { horasMinutos, saldoTexto, textoDoDia, type Espelho } from "./espelho-4e";

// Marco 4L — Fechamento do mês e relatório de horas extras/faltas.
// Tudo sai do mesmo espelho (4E/4G/4H). Aqui só separamos os totais do jeito que o escritório usa.
// Percentuais são a regra geral da lei (não é parecer): dia de trabalho e sábado fora da jornada = no mínimo 50%
// (CF art. 7º XVI); domingo e feriado trabalhados sem folga = em dobro (Lei 605/49 art. 9º; TST Súmula 146).
// Convenção coletiva pode mudar os percentuais — o DP confere.
export type Resumo4l = {
  marcacoes: number; diasTrabalhados: number; minutos: number;
  extra50: number; sabado: number; domingoFeriado: number; atrasos: number;
  faltas: number; minutosFalta: number; abonos: number; conferir: number; diasAcima2h: number; saldo: number;
};
export const resumo4lSchema = z.object({
  marcacoes: z.number().int().nonnegative(), diasTrabalhados: z.number().int().nonnegative(), minutos: z.number().int(),
  extra50: z.number().int(), sabado: z.number().int(), domingoFeriado: z.number().int(), atrasos: z.number().int(),
  faltas: z.number().int().nonnegative(), minutosFalta: z.number().int(), abonos: z.number().int().nonnegative(),
  conferir: z.number().int().nonnegative(), diasAcima2h: z.number().int().nonnegative(), saldo: z.number().int(),
});
export const dia4lSchema = z.object({ d: z.string().regex(/^20\d{2}-\d{2}-\d{2}$/), s: z.string().max(4), h: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(24),
  m: z.number().int(), b: z.number().int().nullable(), o: z.string().max(120) });
export type Dia4l = z.infer<typeof dia4lSchema>;

export function resumoHoras4l(espelho: Espelho): Resumo4l {
  const r: Resumo4l = { marcacoes: espelho.totais.marcacoes, diasTrabalhados: espelho.totais.diasComMarcacao, minutos: espelho.totais.minutos,
    extra50: 0, sabado: 0, domingoFeriado: 0, atrasos: 0, faltas: 0, minutosFalta: 0, abonos: espelho.totais.abonos,
    conferir: espelho.totais.diasSemMarcacao + espelho.totais.diasImpares, diasAcima2h: 0, saldo: espelho.totais.saldo };
  for (const d of espelho.dias) {
    const saldo = d.saldo ?? 0;
    if (d.situacao === "extra") { r.extra50 += saldo; if (saldo > 120) r.diasAcima2h++; }
    else if (d.situacao === "atraso") r.atrasos += saldo;
    else if (d.situacao === "falta") { r.faltas++; r.minutosFalta += saldo; }
    else if (d.situacao === "feriado_trabalhado") r.domingoFeriado += saldo;
    else if (d.situacao === "fora_jornada") { if (d.domingo) r.domingoFeriado += saldo; else r.sabado += saldo; if (saldo > 120 && !d.domingo) r.diasAcima2h++; }
  }
  return r;
}

/** Foto compacta dos dias (o que o funcionário vai ver e confirmar). */
export function fotoDias4l(espelho: Espelho): Dia4l[] {
  return espelho.dias.map(d => ({ d: d.data, s: d.diaSemana, h: d.horarios, m: d.minutos, b: d.saldo, o: textoDoDia(d).slice(0, 120) }));
}

export const fechamentoGestao4l = z.object({ id: z.coerce.number().int(), employee_id: z.uuid(), fechado_em: z.string(),
  resposta: z.enum(["confirmado", "contestado"]).nullable(), respondido_em: z.string().nullable(), comentario: z.string().nullable(),
  resumo: z.unknown(), mudou: z.boolean(), reaberturas: z.number().int() });
export const fechamentoApp4l = z.object({ id: z.coerce.number().int(), mes: z.string().regex(/^20\d{2}-\d{2}$/), resumo: resumo4lSchema,
  dias: z.array(dia4lSchema).max(31), fechado_em: z.string(), resposta: z.enum(["confirmado", "contestado"]).nullable(),
  respondido_em: z.string().nullable(), comentario: z.string().nullable() });
export type FechamentoApp4l = z.infer<typeof fechamentoApp4l>;

export type Situacao4l = "aberto" | "esperando" | "confirmado" | "contestado" | "mudou";
export function situacaoFechamento4l(f: { resposta: string | null; mudou?: boolean } | undefined): Situacao4l {
  if (!f) return "aberto";
  if (f.mudou) return "mudou";
  return f.resposta === "confirmado" ? "confirmado" : f.resposta === "contestado" ? "contestado" : "esperando";
}
export const TEXTO_SITUACAO_4L: Record<Situacao4l, string> = {
  aberto: "Aberto", esperando: "Fechado · esperando o funcionário conferir", confirmado: "Fechado · funcionário confirmou",
  contestado: "Funcionário disse que tem algo errado", mudou: "Chegou marcação depois do fechamento — reabra e feche de novo",
};

/** Texto curto do mês para o funcionário: "8 dias · 70h15 · extras +2h10 · 1 falta". */
export function linhaResumo4l(r: Resumo4l) {
  const partes = [`${r.diasTrabalhados} dia(s) trabalhado(s)`, `${horasMinutos(r.minutos)} registradas`];
  const extras = r.extra50 + r.sabado + r.domingoFeriado;
  if (extras) partes.push(`horas a mais ${saldoTexto(extras)}`);
  if (r.atrasos) partes.push(`atrasos/saídas antes ${saldoTexto(r.atrasos)}`);
  if (r.faltas) partes.push(`${r.faltas} falta(s)`);
  return partes.join(" · ");
}

// Planilha (CSV) para o DP/contador: separador ";" e BOM para o Excel em português abrir certo. Horas em "h:mm".
const hm = (min: number) => `${min < 0 ? "-" : ""}${Math.floor(Math.abs(min) / 60)}:${String(Math.abs(min) % 60).padStart(2, "0")}`;
const celula = (v: string) => /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
// Texto digitado (nome, matrícula): começar com = + - @ vira fórmula no Excel; um apóstrofo na frente impede.
const texto = (v: string) => (/^[=+\-@\t]/.test(v) ? `'${v}` : v);
export function planilha4l(mes: string, linhas: { nome: string; matricula: string | null; resumo: Resumo4l; situacao: Situacao4l }[]) {
  const cab = ["Mes", "Funcionario", "Matricula", "Dias trabalhados", "Horas registradas", "Extra dia de trabalho (50%)", "Sabado fora da jornada (50%)",
    "Domingo/feriado trabalhado (100%)", "Atrasos e saidas antes", "Faltas (dias)", "Horas de falta", "Abonos (dias)", "Dias para conferir",
    "Dias com mais de 2h extras", "Saldo do mes", "Fechamento"];
  const corpo = linhas.map(l => [mes, texto(l.nome), texto(l.matricula ?? ""), String(l.resumo.diasTrabalhados), hm(l.resumo.minutos), hm(l.resumo.extra50), hm(l.resumo.sabado),
    hm(l.resumo.domingoFeriado), hm(l.resumo.atrasos), String(l.resumo.faltas), hm(l.resumo.minutosFalta), String(l.resumo.abonos), String(l.resumo.conferir),
    String(l.resumo.diasAcima2h), hm(l.resumo.saldo), TEXTO_SITUACAO_4L[l.situacao]].map(celula).join(";"));
  return "﻿" + [cab.join(";"), ...corpo].join("\r\n") + "\r\n";
}
