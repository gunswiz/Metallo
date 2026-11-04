// Marco 10D — frota sem internet.
// Checklist, saída e chegada feitos sem sinal ficam guardados no celular (por funcionário) e são enviados quando a internet voltar.
// Cada registro leva a sua chave de segurança (a mesma do envio normal), então reenviar nunca duplica. As fotos tiradas sem sinal
// ficam no armazenamento do navegador (IndexedDB) e sobem junto, antes do registro.
import { mensagemErroFrota10a, textoErroFrota10a, type CaminhaoApp10a, type ItemChecklist10a, type RespostaChecklist10a, type ViagemApp10a } from "./contrato-10a";
import type { ConferenciaRecusa10e } from "./contrato-10a";

export type Payload =
  | { tipo: "checklist"; local: string; obs: string; respostas: RespostaChecklist10a[] }
  | { tipo: "saida"; destino: string; acompanhantes: string; km: number; obs: string }
  | { tipo: "chegada"; viagem: number; km: number; problema: string; obs: string; foto?: string };
export type Pendente = { id: string; veiculo: number; nome: string; criado: string; payload: Payload; fotosLocais?: string[]; fotosEnviadas?: Record<string, string>; fotoPendente?: boolean; revisar?: boolean };
export type Recusada = { id: string; nome: string; tipo: Payload["tipo"]; motivo: string; registro?: Pendente; recebidoEmRegistro?: string; conferencia?: ConferenciaRecusa10e };
export type Cache = { em: string; caminhoes: CaminhaoApp10a[]; itens: ItemChecklist10a[]; viagens: ViagemApp10a[]; modelos?:Record<string,ItemChecklist10a[]> };

/** O que a fila precisa do app (as mesmas ações da tela de caminhões). */
export type AcoesFila = {
  checklist: (veiculo: number, local: string, obs: string, respostas: RespostaChecklist10a[], chave: string) => Promise<"liberado" | "ressalvas" | "nao_liberado">;
  saida: (veiculo: number, destino: string, acompanhantes: string, km: number, obs: string, chave: string) => Promise<void>;
  foto: (veiculo: number, arquivo: Blob) => Promise<string>;
  chegada: (viagem: number, km: number, problema: string, obs: string, chave: string, foto?: string, veiculo?: number) => Promise<boolean>;
};

export const LIMITE_FILA_10D = 15;
export const FOTO_LOCAL = /^local:[0-9a-f-]{36}$/;
const chaveFila = (quem: string) => `metallo-frota-fila-10d:${quem}`;
const chaveRecusadas = (quem: string) => `metallo-frota-recusadas-10d:${quem}`;
const chaveCache = (quem: string) => `metallo-frota-cache-10d:${quem}`;

function ler<T>(chave: string, padrao: T): T {
  try { const v = window.localStorage.getItem(chave); return v ? JSON.parse(v) as T : padrao; } catch { return padrao; }
}
function gravar(chave: string, valor: unknown) {
  try { window.localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch { return false; }
}

/** Falha de rede (não é erro de regra): o registro fica guardado e é reenviado depois. */
export function ehFalhaDeConexao10d(erro: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const nome = erro && typeof erro === "object" && "name" in erro && typeof erro.name === "string" ? erro.name : "";
  const m = `${nome} ${textoErroFrota10a(erro)}`;
  return /SEM_CONEXAO|FunctionsFetchError|Failed to fetch|NetworkError|Network request failed|Failed to send a request|Load failed/.test(m);
}

export function lerFila(quem: string): Pendente[] {
  const lista = ler<Pendente[]>(chaveFila(quem), []);
  return Array.isArray(lista) ? lista.filter(p => p && typeof p.id === "string" && typeof p.veiculo === "number" && p.payload && typeof p.payload.tipo === "string") : [];
}
/** Guarda no celular. Mesmo registro não duplica. Devolve false se não couber ou não der para gravar. */
export function guardarNaFila(quem: string, p: Pendente) {
  const fila = lerFila(quem);
  if (fila.some(x => x.id === p.id)) return true;
  if (fila.length >= LIMITE_FILA_10D) return false;
  return gravar(chaveFila(quem), [...fila, p]);
}
export function atualizarNaFila(quem: string, p: Pendente) { return gravar(chaveFila(quem), lerFila(quem).map(x => x.id === p.id ? p : x)); }
export function tirarDaFila(quem: string, id: string) { gravar(chaveFila(quem), lerFila(quem).filter(x => x.id !== id)); }

export function lerRecusadas(quem: string): Recusada[] {
  const lista = ler<Recusada[]>(chaveRecusadas(quem), []);
  return Array.isArray(lista) ? lista : [];
}
export function anotarRecusa(quem: string, r: Recusada) {
  if (!gravar(chaveRecusadas(quem), [...lerRecusadas(quem).filter(x => x.id !== r.id), r])) return false;
  tirarDaFila(quem, r.id); return true;
}
export function temRelatoDeDefeito(p?: Pendente) {
  return p?.payload.tipo === "checklist" ? p.payload.respostas.some(r => r.situacao === "N") : p?.payload.tipo === "chegada" && Boolean(p.payload.problema.trim());
}
export function recusaBloqueiaSaida(r: Recusada) { return !r.recebidoEmRegistro && !r.conferencia?.conferido_em && temRelatoDeDefeito(r.registro); }
// JSON vindo do banco pode ter outra ordem de propriedades; arrays continuam ordenados.
function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") return `{${Object.entries(valor).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(",")}}`;
  return JSON.stringify(valor) ?? "null";
}
/** Aceita exclusivamente a resposta do servidor para a chave, veículo e conteúdo originais. */
export function guardarConferenciaRecusa(quem: string, prova: ConferenciaRecusa10e) {
  const recusas = lerRecusadas(quem), r = recusas.find(x => x.id === prova.chave);
  if (!r?.registro || r.registro.veiculo !== prova.veiculo || canonico(r.registro.payload) !== canonico(prova.relato)) return false;
  return gravar(chaveRecusadas(quem), recusas.map(x => x.id === r.id ? { ...x, conferencia: prova } : x));
}
/** Conserva o relato e vincula a confirmação somente quando os mesmos defeitos foram recebidos. */
function reconhecerRelatoRecebido(quem: string, recebido: Pendente) {
  const novo = recebido.payload;
  const recusas = lerRecusadas(quem);
  const atualizadas = recusas.map(r => {
    const antigo = r.registro?.payload;
    if (!recusaBloqueiaSaida(r) || r.registro?.veiculo !== recebido.veiculo || !antigo || r.id === recebido.id) return r;
    const corresponde = antigo.tipo === "checklist" && novo.tipo === "checklist"
      ? antigo.respostas.filter(x => x.situacao === "N").every(x => Boolean(x.versao) && novo.respostas.some(y => y.versao === x.versao && y.codigo === x.codigo && y.situacao === "N" && y.obs.trim() === x.obs.trim()))
      : antigo.tipo === "chegada" && novo.tipo === "chegada" && antigo.viagem === novo.viagem && antigo.problema.trim() === novo.problema.trim();
    return corresponde ? { ...r, recebidoEmRegistro: recebido.id } : r;
  });
  if (atualizadas.some((r, i) => r !== recusas[i])) gravar(chaveRecusadas(quem), atualizadas);
}
export function limparRecusadas(quem: string) {
  // Ciência de um aviso não comprova que um defeito chegou à Gestão.
  return gravar(chaveRecusadas(quem), lerRecusadas(quem).filter(r => temRelatoDeDefeito(r.registro)));
}

/** Última lista de caminhões/itens conferida com o servidor, para abrir a tela sem sinal. */
export function lerCache(quem: string): Cache | null {
  const c = ler<Cache | null>(chaveCache(quem), null);
  if (!c || !Array.isArray(c.caminhoes) || !Array.isArray(c.itens) || !Array.isArray(c.viagens)) return null;
  const data = new Date(c.em), hoje = new Date();
  if (!Number.isFinite(data.getTime()) || data > hoje || hoje.getTime() - data.getTime() > 24 * 3600 * 1000) return null;
  const dia = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "America/Fortaleza" });
  return dia(data) === dia(hoje) ? c : { ...c, caminhoes: c.caminhoes.map(v => ({ ...v, checklist_hoje: null })) };
}
export function gravarCache(quem: string, c: Omit<Cache, "em">) { gravar(chaveCache(quem), { ...c, em: new Date().toISOString() }); }

// ---- Fotos tiradas sem internet (IndexedDB). Se o navegador não deixar, a foto simplesmente não é guardada.
const BANCO = "metallo-frota-10d";
function abrirBanco(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      const pedido = indexedDB.open(BANCO, 1);
      pedido.onupgradeneeded = () => { pedido.result.createObjectStore("fotos", { keyPath: "id" }); };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function mexer<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const banco = await abrirBanco();
  if (!banco) return null;
  return new Promise(resolve => {
    try {
      const pedido = fazer(banco.transaction("fotos", modo).objectStore("fotos"));
      pedido.onsuccess = () => { resolve(pedido.result ?? null); banco.close(); };
      pedido.onerror = () => { resolve(null); banco.close(); };
    } catch { banco.close(); resolve(null); }
  });
}
// O código público continua cabendo nos rascunhos. A chave no aparelho inclui o dono e o veículo.
function chaveFoto(quem: string, veiculo: number, id: string) {
  return quem.trim() && Number.isSafeInteger(veiculo) && veiculo > 0 && FOTO_LOCAL.test(id)
    ? JSON.stringify([quem, veiculo, id]) : null;
}
/** Guarda a foto no celular e devolve o código "local:…" (ou null se não deu). */
export async function guardarFotoLocal(quem: string, veiculo: number, arquivo: Blob): Promise<string | null> {
  const id = `local:${crypto.randomUUID()}`;
  const chave = chaveFoto(quem, veiculo, id);
  if (!chave) return null;
  const ok = await mexer("readwrite", loja => loja.put({ id: chave, blob: arquivo }));
  return ok === null ? null : id;
}
export async function lerFotoLocal(quem: string, veiculo: number, id: string): Promise<Blob | null> {
  const chave = chaveFoto(quem, veiculo, id);
  if (!chave) return null;
  const r = await mexer<{ id: string; blob: Blob } | undefined>("readonly", loja => loja.get(chave) as IDBRequest<{ id: string; blob: Blob } | undefined>);
  return r?.blob ?? null;
}
async function apagarFotoLocal(quem: string, veiculo: number, id: string) {
  const chave = chaveFoto(quem, veiculo, id);
  if (chave) await mexer("readwrite", loja => loja.delete(chave));
}

// ---- Envio
export const textoChecklist10d = (r: "liberado" | "ressalvas" | "nao_liberado") =>
  r === "liberado" ? "Checklist registrado sem não conformidades. Confira a situação do veículo antes de sair; bloqueios anteriores continuam válidos." : r === "ressalvas" ? "Checklist feito com ressalvas. O engenheiro foi avisado. Bloqueios anteriores continuam válidos." : "ATENÇÃO: caminhão NÃO liberado. Avise o engenheiro.";

const fotosDo = (p: Pendente): string[] => p.payload.tipo === "checklist" ? p.payload.respostas.flatMap(r => r.foto ? [r.foto] : []) : p.payload.tipo === "chegada" && p.payload.foto ? [p.payload.foto] : [];
class FotoPendente extends Error {
  constructor() { super("foto_pendente"); }
}
/** Decisão explícita: mantém o defeito e registra a ausência da evidência nas observações. */
export function enviarSemFotosPendentes(quem: string, id: string) {
  const p = lerFila(quem).find(x => x.id === id);
  if (!p?.fotoPendente || p.payload.tipo === "saida") return false;
  const obs = `${p.payload.obs}\nFoto pendente não anexada por decisão do funcionário.`.trim();
  if (obs.length > (p.payload.tipo === "checklist" ? 300 : 200)) return false;
  const payload: Payload = p.payload.tipo === "checklist"
    ? { ...p.payload, obs, respostas: p.payload.respostas.map(r => FOTO_LOCAL.test(r.foto ?? "") ? { ...r, foto: undefined } : r) }
    : { ...p.payload, obs, foto: FOTO_LOCAL.test(p.payload.foto ?? "") ? undefined : p.payload.foto };
  return atualizarNaFila(quem, { ...p, payload, fotosLocais: [...new Set([...(p.fotosLocais ?? []), ...fotosDo(p).filter(f => FOTO_LOCAL.test(f))])], fotoPendente: false, revisar: false });
}

/** Sobe as fotos "local:" (uma vez só: o código novo é gravado na fila) e devolve o registro pronto. */
async function subirFotos(acoes: AcoesFila, quem: string, p: Pendente): Promise<Pendente> {
  let atual = lerFila(quem).find(x => x.id === p.id) ?? p;
  for (const f of [...new Set(fotosDo(atual))]) {
    if (!FOTO_LOCAL.test(f)) continue;
    if (!quem || !guardarNaFila(quem, atual)) throw new Error("fila_cheia");
    const arquivo = await lerFotoLocal(quem, p.veiculo, f);
    if (!arquivo) throw new FotoPendente();
    let remoto: string;
    try { remoto = await acoes.foto(p.veiculo, arquivo); }
    catch (e) { if (ehFalhaDeConexao10d(e)) throw e; throw new FotoPendente(); }
    const payload: Payload = atual.payload.tipo === "checklist"
      ? { ...atual.payload, respostas: atual.payload.respostas.map(r => r.foto === f ? { ...r, foto: remoto } : r) }
      : atual.payload.tipo === "chegada" ? { ...atual.payload, foto: remoto } : atual.payload;
    atual = { ...atual, payload, fotosLocais: [...new Set([...(atual.fotosLocais ?? []), f])], fotosEnviadas: { ...atual.fotosEnviadas, [f]: remoto } };
    if (!atualizarNaFila(quem, atual)) throw new Error("fila_cheia");
  }
  return atual;
}

/** Faz o envio de verdade de um registro (usado ao enviar na hora e ao esvaziar a fila). */
export async function executarPendente(acoes: AcoesFila, quem: string, original: Pendente, doFormulario = false): Promise<string> {
  let entrada = original;
  if (doFormulario) {
    const salvo = lerFila(quem).find(p => p.id === original.id);
    const mapa = salvo?.fotosEnviadas ?? {};
    const x = original.payload;
    const payload: Payload = x.tipo === "checklist" ? { ...x, respostas: x.respostas.map(r => r.foto && mapa[r.foto] ? { ...r, foto: mapa[r.foto] } : r) }
      : x.tipo === "chegada" && x.foto && mapa[x.foto] ? { ...x, foto: mapa[x.foto] } : x;
    entrada = { ...original, payload, fotosLocais: salvo?.fotosLocais, fotosEnviadas: mapa, revisar: true, fotoPendente: false };
    if (salvo && !atualizarNaFila(quem, entrada)) throw new Error("fila_cheia");
  }
  try {
    const p = await subirFotos(acoes, quem, entrada), x = p.payload;
    if (x.tipo === "saida" && lerRecusadas(quem).some(r => r.registro?.veiculo === p.veiculo && recusaBloqueiaSaida(r))) throw new Error("registro_pendente");
    let texto: string;
    if (x.tipo === "checklist") {
      const resultado = await acoes.checklist(p.veiculo, x.local, x.obs, x.respostas, p.id);
      texto = textoChecklist10d(resultado);
      if (resultado !== "liberado") reconhecerRelatoRecebido(quem, p);
    }
    else if (x.tipo === "saida") { await acoes.saida(p.veiculo, x.destino, x.acompanhantes, x.km, x.obs, p.id); texto = "Saída registrada. Boa viagem!"; }
    else {
      const fotoOk = await acoes.chegada(x.viagem, x.km, x.problema, x.obs, p.id, x.problema && x.foto ? x.foto : undefined, p.veiculo);
      reconhecerRelatoRecebido(quem, p);
      texto = x.problema ? `Chegada registrada. O problema foi avisado e o caminhão ficou não liberado.${fotoOk ? "" : " A foto não foi anexada: avise o engenheiro."}` : "Chegada registrada.";
    }
    tirarDaFila(quem, p.id);
    for (const f of [...fotosDo(p), ...(p.fotosLocais ?? [])]) void apagarFotoLocal(quem, p.veiculo, f);
    return texto;
  } catch (erro) {
    if (doFormulario) {
      const salvo = lerFila(quem).find(p => p.id === original.id);
      if (salvo) atualizarNaFila(quem, { ...salvo, revisar: true, fotoPendente: erro instanceof FotoPendente });
    }
    throw erro;
  }
}

export type ResultadoFila = { enviados: { nome: string; texto: string }[]; recusados: Recusada[]; restam: number; impedimento?: string; emAndamento?: boolean };
let rodando = false;
/** Esvazia a fila em ordem (checklist → saída → chegada). Para na primeira falha de conexão; erro de regra vai para as recusadas. */
export async function sincronizarFila(acoes: AcoesFila, quem: string, manual = false): Promise<ResultadoFila> {
  const r: ResultadoFila = { enviados: [], recusados: [], restam: lerFila(quem).length };
  if (rodando) return { ...r, emAndamento: true };
  rodando = true;
  const bloqueados = new Set<number>();
  try {
    for (const p of [...lerFila(quem)].sort((a, b) => a.criado.localeCompare(b.criado))) {
      if (bloqueados.has(p.veiculo) || (p.revisar && !manual)) { bloqueados.add(p.veiculo); continue; }
      try {
        const texto = await executarPendente(acoes, quem, p);
        r.enviados.push({ nome: p.nome, texto });
      } catch (e) {
        if (e instanceof FotoPendente) {
          atualizarNaFila(quem, { ...(lerFila(quem).find(x => x.id === p.id) ?? p), fotoPendente: true, revisar: true });
          r.impedimento = `${p.nome}: ${mensagemErroFrota10a(e)}`; bloqueados.add(p.veiculo); continue;
        }
        if (ehFalhaDeConexao10d(e)) break;
        const conhecido = ["checklist_versao_desatualizada", "veiculo_em_uso", "veiculo_nao_liberado", "veiculo_em_manutencao", "voce_ja_esta_com_um_caminhao", "km_menor_que_atual", "km_menor_que_saida", "checklist_do_dia_necessario", "itens_incompletos", "ciencia_obrigatoria", "destino_invalido", "veiculo_indisponivel"].includes(textoErroFrota10a(e));
        const registro = lerFila(quem).find(x => x.id === p.id) ?? p;
        bloqueados.add(p.veiculo);
        if (!conhecido) {
          atualizarNaFila(quem, { ...registro, revisar: true });
          r.impedimento = `${p.nome}: envio não confirmado. Os dados continuam guardados. Confira a conexão e o acesso e toque em Enviar agora para tentar novamente.`;
          continue;
        }
        const rec: Recusada = { id: p.id, nome: p.nome, tipo: p.payload.tipo, motivo: mensagemErroFrota10a(e), registro };
        if (!anotarRecusa(quem, rec)) { r.impedimento = "Não foi possível guardar o aviso. O registro continua na fila."; break; }
        r.recusados.push(rec);
      }
    }
  } finally { rodando = false; r.restam = lerFila(quem).length; }
  return r;
}
