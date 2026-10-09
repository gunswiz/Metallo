// Marco 4K — ponto sem internet.
// Portaria 671, Anexo IX, itens 4 e 5: excepcionalmente o coletor pode marcar sem conexão; a marcação é enviada
// assim que a internet voltar. Aqui fica a "fila" no próprio celular e o cálculo da hora usada nessa marcação.
// A hora NUNCA é só a do celular: ela é corrigida pela última conferência com o servidor (que por sua vez é conferido
// com a Hora Legal Brasileira — Marco 4J). Cada marcação leva a "prova" de como a hora foi obtida.
import type { LocationInput } from "./geolocalizacao-evento";

export type MetodoHora = "RELOGIO_CONTINUO" | "RELOGIO_DO_CELULAR" | "SEM_CONFERENCIA";
/** Última conferência da hora com o servidor. */
export type Sincronia = { server_at: string; device_at: number; monotonic: number; page: string };
export type Prova = { employee_id: string; metodo: MetodoHora; hora_aparelho: string; ajuste_ms: number | null; sincronizado_em: string | null };
export type ItemFila = { key: string; employee_id: string; marking_at: string; location: LocationInput | null; proof: Prova };
export type Recusada = { key: string; marking_at: string; motivo: string };

export const LIMITE_FILA = 20;
const LIMITE_CONTINUO_MS = 3 * 24 * 3600 * 1000;
const TOLERANCIA_MS = 30_000;
const CHAVE_SINCRONIA = "metallo-ponto-sincronia-4k";
export const chaveFila = (employeeId: string) => `metallo-ponto-fila-4k:${employeeId}`;
export const chaveRecusadas = (employeeId: string) => `metallo-ponto-recusadas-4k:${employeeId}`;
/** Identifica esta abertura da página: o relógio "contínuo" (performance.now) só vale dentro dela. */
export const PAGINA_ATUAL = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

function ler<T>(chave: string, padrao: T): T {
  try { const v = window.localStorage.getItem(chave); return v ? JSON.parse(v) as T : padrao; } catch { return padrao; }
}
function gravar(chave: string, valor: unknown) {
  try { window.localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}

export function lerSincronia(): Sincronia | null {
  const s = ler<Sincronia | null>(CHAVE_SINCRONIA, null);
  return s && typeof s.server_at === "string" && Number.isFinite(Date.parse(s.server_at)) && Number.isFinite(s.device_at) ? s : null;
}
/** Grava a conferência com o servidor. t0/t1 = relógio do celular antes/depois da resposta. */
export function gravarSincronia(serverAt: string, t0: number, t1: number, monotonic: number, page = PAGINA_ATUAL) {
  if (!Number.isFinite(Date.parse(serverAt)) || t1 < t0 || t1 - t0 > 15000) return null;
  const s: Sincronia = { server_at: serverAt, device_at: Math.round((t0 + t1) / 2), monotonic, page };
  gravar(CHAVE_SINCRONIA, s);
  return s;
}

/**
 * Hora a usar numa marcação sem internet.
 * - RELOGIO_CONTINUO: hora do servidor + tempo decorrido sem depender do relógio do celular (mesma página aberta).
 * - RELOGIO_DO_CELULAR: relógio do celular + o ajuste medido na última conferência (página reaberta sem internet).
 * - SEM_CONFERENCIA: o celular nunca conferiu a hora com o servidor; vai marcada para a Gestão conferir.
 * Se o tempo contínuo ficar ATRÁS do celular corrigido (o celular dormiu e o contador parou), vale o celular corrigido.
 */
export function horaParaMarcar(sinc: Sincronia | null, agoraCelular: number, agoraMonotonic: number, page = PAGINA_ATUAL) {
  if (!sinc) return { hora: new Date(agoraCelular), metodo: "SEM_CONFERENCIA" as MetodoHora, ajuste_ms: null, sincronizado_em: null };
  const servidor = Date.parse(sinc.server_at);
  const ajuste = Math.round(servidor - sinc.device_at);
  const corrigida = agoraCelular + ajuste;
  const decorrido = agoraMonotonic - sinc.monotonic;
  const continua = sinc.page === page && decorrido >= 0 && decorrido < LIMITE_CONTINUO_MS ? servidor + decorrido : null;
  const usarContinua = continua !== null && continua >= corrigida - TOLERANCIA_MS;
  return { hora: new Date(Math.round(usarContinua ? continua : corrigida)), metodo: (usarContinua ? "RELOGIO_CONTINUO" : "RELOGIO_DO_CELULAR") as MetodoHora,
    ajuste_ms: ajuste, sincronizado_em: new Date(servidor).toISOString() };
}

export function lerFila(employeeId: string): ItemFila[] {
  const lista = ler<ItemFila[]>(chaveFila(employeeId), []);
  return Array.isArray(lista) ? lista.filter(i => i && i.employee_id === employeeId && typeof i.key === "string" && typeof i.marking_at === "string") : [];
}
export function lerRecusadas(employeeId: string): Recusada[] {
  const lista = ler<Recusada[]>(chaveRecusadas(employeeId), []);
  return Array.isArray(lista) ? lista.slice(-10) : [];
}
/** Guarda a marcação no celular. Mesma chave não duplica. Devolve false se não couber ou não der para gravar. */
export function guardarNaFila(item: ItemFila) {
  const fila = lerFila(item.employee_id);
  if (fila.some(i => i.key === item.key)) return true;
  if (fila.length >= LIMITE_FILA) return false;
  return gravar(chaveFila(item.employee_id), [...fila, item]);
}
export function tirarDaFila(employeeId: string, key: string) {
  gravar(chaveFila(employeeId), lerFila(employeeId).filter(i => i.key !== key));
}
export function anotarRecusa(employeeId: string, item: ItemFila, motivo: string) {
  gravar(chaveRecusadas(employeeId), [...lerRecusadas(employeeId), { key: item.key, marking_at: item.marking_at, motivo }].slice(-10));
  tirarDaFila(employeeId, item.key);
}
export function limparRecusadas(employeeId: string) { gravar(chaveRecusadas(employeeId), []); }

/** Erros que nunca vão dar certo reenviando: a marcação sai da fila e o funcionário é avisado. */
export const RECUSA_DEFINITIVA = /MARCACAO_OFFLINE_ANTIGA|LIMITE_OFFLINE|MARCACAO_NO_FUTURO|FUNCIONARIO_DIFERENTE|PEDIDO_INVALIDO|INTENCAO_CONFLITANTE|CPF_NAO_CADASTRADO/;
export const MOTIVO_RECUSA: Record<string, string> = {
  MARCACAO_OFFLINE_ANTIGA: "ficou mais de 7 dias sem internet",
  LIMITE_OFFLINE: "passou do limite de marcações sem internet no dia",
  MARCACAO_NO_FUTURO: "a hora do celular estava adiantada",
  CPF_NAO_CADASTRADO: "seu CPF ainda não está cadastrado",
};
export function textoRecusa(codigo: string) {
  const chave = Object.keys(MOTIVO_RECUSA).find(k => codigo.includes(k));
  return chave ? MOTIVO_RECUSA[chave] : "o servidor não aceitou";
}
/** Falha de rede (não é erro de regra): a marcação fica guardada e é reenviada depois. */
export function ehFalhaDeConexao(erro: unknown) {
  const m = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro);
  return /SEM_CONEXAO|SERVIDOR_INDISPONIVEL|NAO_CONFIRMADO|fetch|network|Network|timeout|Timeout|abort|Abort|offline|indispon|Load failed|TypeError/.test(m);
}

/** Para a Gestão: por que uma marcação sem internet ficou para conferir (texto simples). */
export const MOTIVO_CONFERIR: Record<string, string> = {
  CELULAR_SEM_CONFERENCIA_DE_HORA: "o celular nunca tinha conferido a hora com o servidor",
  HORA_ANTES_DA_ULTIMA_CONFERENCIA: "a hora ficou antes da última conferência do celular",
  CONFERENCIA_DE_HORA_ANTIGA: "o celular estava há mais de 3 dias sem conferir a hora",
  HORA_INCOERENTE: "a hora enviada não bate com o relógio do celular",
  RELOGIO_DO_CELULAR_MUDOU: "o relógio do celular foi mudado enquanto estava sem internet",
  HORA_A_FRENTE_DO_SERVIDOR: "a hora do celular estava um pouco adiantada (foi usada a hora da chegada)",
};
export const textoConferir = (motivos: string[]) => motivos.map(m => MOTIVO_CONFERIR[m] ?? m.toLowerCase().replace(/_/g, " ")).join("; ");
export const TEXTO_SITUACAO_HORA: Record<"OK" | "ATENCAO" | "FORA_DO_LIMITE" | "SEM_RESPOSTA", string> = {
  OK: "Certa", ATENCAO: "Diferença pequena (dentro do limite de 30 s)", FORA_DO_LIMITE: "FORA DO LIMITE de 30 s", SEM_RESPOSTA: "Sem resposta da hora oficial",
};
export function diferencaTexto(ms: number | null) {
  if (ms === null) return "—";
  const a = Math.abs(ms);
  return a < 1000 ? `${a} milésimos de segundo` : `${(a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}
