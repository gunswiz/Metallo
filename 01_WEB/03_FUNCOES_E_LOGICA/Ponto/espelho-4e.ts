import { z } from "zod";

// Marco 4E — Espelho de ponto: organiza as marcações ORIGINAIS de um mês por dia (fuso de Fortaleza).
// Não altera nada: só lê, agrupa e soma o tempo entre pares de marcações (1ª–2ª, 3ª–4ª…).
// Não calcula hora extra, adicional noturno nem banco de horas (dependem da jornada e da convenção — DP).
export const marcacaoEspelho = z.object({
  event_id: z.uuid(), nsr: z.number().int().positive(), employee_id: z.uuid(), employee_name: z.string().min(1).max(140),
  employee_code: z.string().max(60).nullable(), marking_at: z.iso.datetime(), recorded_at: z.iso.datetime(),
}).strict();
export const respostaEspelho = z.object({
  events: z.array(marcacaoEspelho).max(20000),
  window: z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).strict(),
}).strict();
export type MarcacaoEspelho = z.infer<typeof marcacaoEspelho>;

const TZ = "America/Fortaleza";
const diaFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const horaFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function mesValido(mes: string | undefined) { return typeof mes === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(mes); }
export function mesAtual(agora = new Date()) { return diaFmt.format(agora).slice(0, 7); }
export function mesAnterior(mes: string) { const [a, m] = mes.split("-").map(Number); return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, "0")}`; }
export function mesSeguinte(mes: string) { const [a, m] = mes.split("-").map(Number); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`; }
export function nomeDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 15)));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}
/** 485 → "8h05". */
export function horasMinutos(minutos: number) { const h = Math.floor(minutos / 60), m = Math.round(minutos % 60); return `${h}h${String(m).padStart(2, "0")}`; }

export type DiaEspelho = { data: string; diaSemana: string; domingo: boolean; futuro: boolean; horarios: string[]; nsrs: number[]; minutos: number; impar: boolean };
export type Espelho = { mes: string; dias: DiaEspelho[]; totais: { marcacoes: number; diasComMarcacao: number; minutos: number; diasImpares: number } };

export function montarEspelho(events: Pick<MarcacaoEspelho, "marking_at" | "nsr">[], mes: string, agora = new Date()): Espelho {
  const [ano, m] = mes.split("-").map(Number);
  const totalDias = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const hoje = diaFmt.format(agora);
  const porDia = new Map<string, { at: number; nsr: number }[]>();
  for (const e of events) {
    const data = diaFmt.format(new Date(e.marking_at));
    if (!data.startsWith(mes)) continue;
    porDia.set(data, [...(porDia.get(data) ?? []), { at: Date.parse(e.marking_at), nsr: e.nsr }]);
  }
  const dias: DiaEspelho[] = [];
  for (let d = 1; d <= totalDias; d++) {
    const data = `${mes}-${String(d).padStart(2, "0")}`;
    const semana = new Date(Date.UTC(ano, m - 1, d)).getUTCDay();
    const lista = (porDia.get(data) ?? []).sort((a, b) => a.at - b.at || a.nsr - b.nsr);
    let minutos = 0;
    // Pares em sequência: entrada→saída. Minutos inteiros, como o relógio mostra (segundos não contam).
    for (let i = 0; i + 1 < lista.length; i += 2) minutos += Math.floor(lista[i + 1].at / 60000) - Math.floor(lista[i].at / 60000);
    dias.push({ data, diaSemana: SEMANA[semana], domingo: semana === 0, futuro: data > hoje, horarios: lista.map(x => horaFmt.format(new Date(x.at))),
      nsrs: lista.map(x => x.nsr), minutos, impar: lista.length % 2 === 1 });
  }
  return { mes, dias, totais: {
    marcacoes: dias.reduce((s, d) => s + d.horarios.length, 0), diasComMarcacao: dias.filter(d => d.horarios.length).length,
    minutos: dias.reduce((s, d) => s + d.minutos, 0), diasImpares: dias.filter(d => d.impar && !(d.data === hoje)).length } };
}

export type ResumoFuncionario = { employee_id: string; nome: string; matricula: string | null; espelho: Espelho };
export function espelhosPorFuncionario(events: MarcacaoEspelho[], mes: string, agora = new Date()): ResumoFuncionario[] {
  const grupos = new Map<string, MarcacaoEspelho[]>();
  for (const e of events) grupos.set(e.employee_id, [...(grupos.get(e.employee_id) ?? []), e]);
  return [...grupos.entries()].map(([id, lista]) => {
    const ultimo = lista.reduce((a, b) => (a.nsr > b.nsr ? a : b));
    return { employee_id: id, nome: ultimo.employee_name, matricula: ultimo.employee_code, espelho: montarEspelho(lista, mes, agora) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
