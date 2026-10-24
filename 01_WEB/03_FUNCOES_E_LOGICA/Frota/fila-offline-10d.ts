// Marco 10D — frota sem internet.
// Checklist, saída e chegada feitos sem sinal ficam guardados no celular (por funcionário) e são enviados quando a internet voltar.
// Cada registro leva a sua chave de segurança (a mesma do envio normal), então reenviar nunca duplica. As fotos tiradas sem sinal
// ficam no armazenamento do navegador (IndexedDB) e sobem junto, antes do registro.
import { mensagemErroFrota10a, type CaminhaoApp10a, type ItemChecklist10a, type RespostaChecklist10a, type ViagemApp10a } from "./contrato-10a";

export type Payload =
  | { tipo: "checklist"; local: string; obs: string; respostas: RespostaChecklist10a[] }
  | { tipo: "saida"; destino: string; acompanhantes: string; km: number; obs: string }
  | { tipo: "chegada"; viagem: number; km: number; problema: string; obs: string; foto?: string };
export type Pendente = { id: string; veiculo: number; nome: string; criado: string; payload: Payload };
export type Recusada = { id: string; nome: string; tipo: Payload["tipo"]; motivo: string };
export type Cache = { em: string; caminhoes: CaminhaoApp10a[]; itens: ItemChecklist10a[]; viagens: ViagemApp10a[] };

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
  const m = erro instanceof Error ? `${erro.name} ${erro.message}` : String(erro ?? "");
  return /SEM_CONEXAO|FunctionsFetchError|Failed to send|fetch|network|Network|timeout|Timeout|abort|Abort|Load failed|TypeError/.test(m);
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
export function atualizarNaFila(quem: string, p: Pendente) { gravar(chaveFila(quem), lerFila(quem).map(x => x.id === p.id ? p : x)); }
export function tirarDaFila(quem: string, id: string) { gravar(chaveFila(quem), lerFila(quem).filter(x => x.id !== id)); }

export function lerRecusadas(quem: string): Recusada[] {
  const lista = ler<Recusada[]>(chaveRecusadas(quem), []);
  return Array.isArray(lista) ? lista.slice(-10) : [];
}
export function anotarRecusa(quem: string, r: Recusada) { gravar(chaveRecusadas(quem), [...lerRecusadas(quem), r].slice(-10)); tirarDaFila(quem, r.id); }
export function limparRecusadas(quem: string) { gravar(chaveRecusadas(quem), []); }

/** Última lista de caminhões/itens conferida com o servidor, para abrir a tela sem sinal. */
export function lerCache(quem: string): Cache | null {
  const c = ler<Cache | null>(chaveCache(quem), null);
  return c && Array.isArray(c.caminhoes) && Array.isArray(c.itens) && Array.isArray(c.viagens) ? c : null;
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
/** Guarda a foto no celular e devolve o código "local:…" (ou null se não deu). */
export async function guardarFotoLocal(arquivo: Blob): Promise<string | null> {
  const id = `local:${crypto.randomUUID()}`;
  const ok = await mexer("readwrite", loja => loja.put({ id, blob: arquivo }));
  return ok === null ? null : id;
}
export async function lerFotoLocal(id: string): Promise<Blob | null> {
  if (!FOTO_LOCAL.test(id)) return null;
  const r = await mexer<{ id: string; blob: Blob } | undefined>("readonly", loja => loja.get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>);
  return r?.blob ?? null;
}
export async function apagarFotoLocal(id: string) { if (FOTO_LOCAL.test(id)) await mexer("readwrite", loja => loja.delete(id)); }

// ---- Envio
export const textoChecklist10d = (r: "liberado" | "ressalvas" | "nao_liberado") =>
  r === "liberado" ? "Checklist feito. Caminhão liberado." : r === "ressalvas" ? "Checklist feito com ressalvas. O engenheiro foi avisado." : "ATENÇÃO: caminhão NÃO liberado. Avise o engenheiro.";

const fotosDo = (p: Pendente): string[] => p.payload.tipo === "checklist" ? p.payload.respostas.flatMap(r => r.foto ? [r.foto] : []) : p.payload.tipo === "chegada" && p.payload.foto ? [p.payload.foto] : [];

/** Sobe as fotos "local:" (uma vez só: o código novo é gravado na fila) e devolve o registro pronto. */
async function subirFotos(acoes: AcoesFila, quem: string, p: Pendente): Promise<Pendente> {
  const troca = new Map<string, string | null>();
  for (const f of fotosDo(p)) {
    if (!FOTO_LOCAL.test(f)) continue;
    const arquivo = await lerFotoLocal(f);
    if (!arquivo) { troca.set(f, null); continue; } // a foto sumiu do celular: segue sem ela
    try { troca.set(f, await acoes.foto(p.veiculo, arquivo)); }
    catch (e) { if (ehFalhaDeConexao10d(e)) throw e; troca.set(f, null); } // a foto não foi aceita: o registro segue sem ela
  }
  if (!troca.size) return p;
  const novo: Pendente = p.payload.tipo === "checklist"
    ? { ...p, payload: { ...p.payload, respostas: p.payload.respostas.map(r => { if (!r.foto || !troca.has(r.foto)) return r; const id = troca.get(r.foto), copia = { ...r }; delete copia.foto; return id ? { ...copia, foto: id } : copia; }) } }
    : p.payload.tipo === "chegada" ? { ...p, payload: { ...p.payload, foto: (p.payload.foto && troca.get(p.payload.foto)) || undefined } } : p;
  atualizarNaFila(quem, novo);
  for (const antiga of troca.keys()) void apagarFotoLocal(antiga);
  return novo;
}

/** Faz o envio de verdade de um registro (usado ao enviar na hora e ao esvaziar a fila). */
export async function executarPendente(acoes: AcoesFila, quem: string, original: Pendente): Promise<string> {
  const p = await subirFotos(acoes, quem, original), x = p.payload;
  if (x.tipo === "checklist") return textoChecklist10d(await acoes.checklist(p.veiculo, x.local, x.obs, x.respostas, p.id));
  if (x.tipo === "saida") { await acoes.saida(p.veiculo, x.destino, x.acompanhantes, x.km, x.obs, p.id); return "Saída registrada. Boa viagem!"; }
  const fotoOk = await acoes.chegada(x.viagem, x.km, x.problema, x.obs, p.id, x.problema && x.foto ? x.foto : undefined, p.veiculo);
  return x.problema ? `Chegada registrada. O problema foi avisado e o caminhão ficou não liberado.${fotoOk ? "" : " A foto não foi anexada: avise o engenheiro."}` : "Chegada registrada.";
}

export type ResultadoFila = { enviados: { nome: string; texto: string }[]; recusados: Recusada[]; restam: number };
let rodando = false;
/** Esvazia a fila em ordem (checklist → saída → chegada). Para na primeira falha de conexão; erro de regra vai para as recusadas. */
export async function sincronizarFila(acoes: AcoesFila, quem: string): Promise<ResultadoFila> {
  const r: ResultadoFila = { enviados: [], recusados: [], restam: lerFila(quem).length };
  if (rodando) return r;
  rodando = true;
  try {
    for (const p of [...lerFila(quem)].sort((a, b) => a.criado.localeCompare(b.criado))) {
      try {
        const texto = await executarPendente(acoes, quem, p);
        tirarDaFila(quem, p.id);
        for (const f of fotosDo(p)) void apagarFotoLocal(f);
        r.enviados.push({ nome: p.nome, texto });
      } catch (e) {
        if (ehFalhaDeConexao10d(e)) break;
        const rec: Recusada = { id: p.id, nome: p.nome, tipo: p.payload.tipo, motivo: mensagemErroFrota10a(e) };
        anotarRecusa(quem, rec);
        for (const f of fotosDo(p)) void apagarFotoLocal(f);
        r.recusados.push(rec);
      }
    }
  } finally { rodando = false; r.restam = lerFila(quem).length; }
  return r;
}
