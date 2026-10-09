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

// Marco 4G — jornada (horário contratual): "1" = segunda … "7" = domingo; pares entrada/saída "hh:mm".
export const jornadaSchema = z.record(z.enum(["1", "2", "3", "4", "5", "6", "7"]), z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).max(8));
export type Jornada = Record<string, string[]>;
export const JORNADA_PADRAO: Jornada = { "1": ["07:00", "12:00", "13:00", "17:00"], "2": ["07:00", "12:00", "13:00", "17:00"], "3": ["07:00", "12:00", "13:00", "17:00"],
  "4": ["07:00", "12:00", "13:00", "17:00"], "5": ["07:00", "12:00", "13:00", "16:00"], "6": [], "7": [] };
const paraMinutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
export function minutosPrevistos(horarios: string[]) { let t = 0; for (let i = 0; i + 1 < horarios.length; i += 2) t += paraMinutos(horarios[i + 1]) - paraMinutos(horarios[i]); return t; }
/** +1h05 / −0h20 / 0h00 */
export function saldoTexto(minutos: number) { return `${minutos > 0 ? "+" : minutos < 0 ? "−" : ""}${horasMinutos(Math.abs(minutos))}`; }

export type SituacaoDia = "normal" | "tolerado" | "extra" | "atraso" | "sem_marcacao" | "falta_marcar" | "em_andamento" | "folga" | "fora_jornada" | "futuro"
  | "feriado" | "feriado_trabalhado" | "abonado" | "falta";
// Marco 4H — ocorrências lançadas pela Gestão (tratamento). Não mexem nas marcações originais.
export const TIPOS_OCORRENCIA = ["atestado", "ferias", "folga", "falta_justificada", "falta", "folga_feriado"] as const;
export type TipoOcorrencia = (typeof TIPOS_OCORRENCIA)[number];
export const NOME_OCORRENCIA: Record<TipoOcorrencia, string> = { atestado: "Atestado", ferias: "Férias", folga: "Folga", falta_justificada: "Falta justificada",
  falta: "Falta (não justificada)", folga_feriado: "Folga no lugar de feriado" };
export type ExtrasEspelho = { feriados?: Record<string, string>; ocorrencias?: Record<string, { tipo: TipoOcorrencia; id?: number }> };
export type DiaEspelho = { data: string; diaSemana: string; domingo: boolean; futuro: boolean; horarios: string[]; nsrs: number[]; minutos: number; impar: boolean;
  previstos: string[]; previsto: number; saldo: number | null; situacao: SituacaoDia; feriado?: string; ocorrencia?: { tipo: TipoOcorrencia; id?: number } };
export type Espelho = { mes: string; dias: DiaEspelho[]; totais: { marcacoes: number; diasComMarcacao: number; minutos: number; diasImpares: number;
  previsto: number; extras: number; atrasos: number; saldo: number; diasSemMarcacao: number; faltas: number; abonos: number } };

/**
 * Saldo do dia (CLT art. 58 §1º): variações de até 5 minutos em cada marcação, somando no máximo 10 no dia, não contam.
 * Passou disso, conta a diferença inteira (TST, Súmula 366). Hora extra com adicional, intervalo e banco de horas: DP/convenção.
 */
export function saldoDoDia(marcas: number[], previstos: string[]) {
  const previsto = minutosPrevistos(previstos);
  let trabalhado = 0; for (let i = 0; i + 1 < marcas.length; i += 2) trabalhado += marcas[i + 1] - marcas[i];
  if (marcas.length === previstos.length && previstos.length > 0) {
    const desvios = previstos.map((h, i) => Math.abs(marcas[i] - paraMinutos(h)));
    if (desvios.every(d => d <= 5) && desvios.reduce((a, b) => a + b, 0) <= 10) return { saldo: 0, tolerado: trabalhado !== previsto };
  }
  return { saldo: trabalhado - previsto, tolerado: false };
}

export function montarEspelho(events: Pick<MarcacaoEspelho, "marking_at" | "nsr">[], mes: string, agora = new Date(), jornada: Jornada = JORNADA_PADRAO, extras: ExtrasEspelho = {}): Espelho {
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
    const horarios = lista.map(x => horaFmt.format(new Date(x.at)));
    const marcas = horarios.map(paraMinutos);
    let minutos = 0;
    // Pares em sequência: entrada→saída. Minutos inteiros, como o relógio mostra (segundos não contam).
    for (let i = 0; i + 1 < marcas.length; i += 2) minutos += marcas[i + 1] - marcas[i];
    const feriado = extras.feriados?.[data], ocorrencia = extras.ocorrencias?.[data];
    // Feriado: não há jornada prevista no dia.
    const previstos = feriado ? [] : jornada[String(semana === 0 ? 7 : semana)] ?? [];
    const previsto = minutosPrevistos(previstos), futuro = data > hoje, impar = lista.length % 2 === 1;
    let saldo: number | null = null, situacao: SituacaoDia;
    if (ocorrencia && !futuro && ocorrencia.tipo === "falta") { saldo = minutos - minutosPrevistos(jornada[String(semana === 0 ? 7 : semana)] ?? []); situacao = "falta"; }
    else if (ocorrencia && !futuro) { saldo = 0; situacao = "abonado"; }
    else if (futuro) situacao = feriado ? "feriado" : "futuro";
    else if (feriado) { situacao = lista.length ? "feriado_trabalhado" : "feriado"; saldo = lista.length && !impar ? minutos : null; }
    else if (!lista.length) situacao = previsto ? (data === hoje ? "em_andamento" : "sem_marcacao") : "folga";
    else if (impar || lista.length < previstos.length && data === hoje) situacao = data === hoje ? "em_andamento" : "falta_marcar";
    else if (!previsto) { saldo = minutos; situacao = "fora_jornada"; }
    else { const r = saldoDoDia(marcas, previstos); saldo = r.saldo; situacao = r.saldo > 0 ? "extra" : r.saldo < 0 ? "atraso" : r.tolerado ? "tolerado" : "normal"; }
    dias.push({ data, diaSemana: SEMANA[semana], domingo: semana === 0, futuro, horarios, nsrs: lista.map(x => x.nsr), minutos, impar,
      previstos, previsto, saldo, situacao, ...(feriado ? { feriado } : {}), ...(ocorrencia ? { ocorrencia } : {}) });
  }
  return { mes, dias, totais: {
    marcacoes: dias.reduce((s, d) => s + d.horarios.length, 0), diasComMarcacao: dias.filter(d => d.horarios.length).length,
    minutos: dias.reduce((s, d) => s + d.minutos, 0), diasImpares: dias.filter(d => d.situacao === "falta_marcar").length,
    previsto: dias.filter(d => !d.futuro && d.data < hoje).reduce((s, d) => s + d.previsto, 0),
    extras: dias.reduce((s, d) => s + Math.max(0, d.saldo ?? 0), 0), atrasos: dias.reduce((s, d) => s + Math.min(0, d.saldo ?? 0), 0),
    saldo: dias.reduce((s, d) => s + (d.saldo ?? 0), 0), diasSemMarcacao: dias.filter(d => d.situacao === "sem_marcacao").length,
    faltas: dias.filter(d => d.situacao === "falta").length, abonos: dias.filter(d => d.situacao === "abonado").length } };
}

export type ResumoFuncionario = { employee_id: string; nome: string; matricula: string | null; espelho: Espelho };
export const TEXTO_SITUACAO: Record<SituacaoDia, string> = {
  normal: "", tolerado: "Dentro da tolerância (até 5 min por marcação, 10 no dia)", extra: "Passou do horário", atraso: "Faltou tempo (atraso ou saída antes)",
  sem_marcacao: "Sem marcação — falta, folga, atestado ou feriado? Conferir", falta_marcar: "Falta uma marcação (entrada ou saída)",
  em_andamento: "Dia em andamento", folga: "", fora_jornada: "Trabalhou em dia sem jornada", futuro: "",
  feriado: "Feriado", feriado_trabalhado: "Trabalhou no feriado", abonado: "Abonado", falta: "Falta (não justificada)",
};
/** Texto da observação do dia, com o nome do feriado ou da ocorrência. */
export function textoDoDia(d: DiaEspelho) {
  if (d.ocorrencia) return NOME_OCORRENCIA[d.ocorrencia.tipo];
  if (d.feriado) return `${TEXTO_SITUACAO[d.situacao]}: ${d.feriado}`;
  return TEXTO_SITUACAO[d.situacao];
}

export function espelhosPorFuncionario(events: MarcacaoEspelho[], mes: string, agora = new Date(), jornada: Jornada = JORNADA_PADRAO,
  feriados: Record<string, string> = {}, ocorrencias: Record<string, Record<string, { tipo: TipoOcorrencia; id?: number }>> = {}): ResumoFuncionario[] {
  const grupos = new Map<string, MarcacaoEspelho[]>();
  for (const e of events) grupos.set(e.employee_id, [...(grupos.get(e.employee_id) ?? []), e]);
  return [...grupos.entries()].map(([id, lista]) => {
    const ultimo = lista.reduce((a, b) => (a.nsr > b.nsr ? a : b));
    return { employee_id: id, nome: ultimo.employee_name, matricula: ultimo.employee_code, espelho: montarEspelho(lista, mes, agora, jornada, { feriados, ocorrencias: ocorrencias[id] ?? {} }) };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "seg a qui 07:00–12:00 e 13:00–17:00; sex 07:00–12:00 e 13:00–16:00" (dias seguidos com o mesmo horário juntos). */
export function descreverJornada(jornada: Jornada) {
  const nomes = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  const pares = (h: string[]) => { const out: string[] = []; for (let i = 0; i + 1 < h.length; i += 2) out.push(`${h[i]}–${h[i + 1]}`); return out.join(" e "); };
  const grupos: { de: number; ate: number; texto: string }[] = [];
  for (let d = 1; d <= 7; d++) {
    const texto = pares(jornada[String(d)] ?? []);
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.texto === texto && ultimo.ate === d - 1) ultimo.ate = d; else grupos.push({ de: d, ate: d, texto });
  }
  return grupos.filter(g => g.texto).map(g => `${nomes[g.de - 1]}${g.ate > g.de ? ` a ${nomes[g.ate - 1]}` : ""} ${g.texto}`).join("; ");
}

/** "2026-10" → { de: "2026-10-01", ate: "2026-10-31" } */
export function intervaloDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return { de: `${mes}-01`, ate: `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}` };
}
