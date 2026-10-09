"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PackagePlus } from "lucide-react";
import { lerQuantidade3t, STATUS_PEDIDO_3T, type Material3t, type MeuPedido3t } from "@/03_FUNCOES_E_LOGICA/Pedidos/pedido-material-3t";
import styles from "./colaborador.module.css";

type Acoes = { materiais: () => Promise<Material3t[]>; meus: () => Promise<MeuPedido3t[]>;
  pedir: (itemId: string, quantidade: number, observacao: string, chave: string) => Promise<void>; cancelar: (id: number) => Promise<void> };

const dia = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Marco 3T — "Pedir material": o funcionário pede o que vai usar na obra; o escritório responde.
export function PedirMaterial({ acoes }: { acoes: Acoes }) {
  const [materiais, setMateriais] = useState<Material3t[]>([]), [pedidos, setPedidos] = useState<MeuPedido3t[]>([]);
  const [item, setItem] = useState(""), [quantidade, setQuantidade] = useState("1"), [obs, setObs] = useState("");
  const [status, setStatus] = useState("Carregando…"), [enviando, setEnviando] = useState(false);
  const ref = useRef(acoes), chave = useRef<string | null>(null);
  useEffect(() => { ref.current = acoes; }, [acoes]);
  const carregar = useCallback(async () => {
    try { const [m, p] = await Promise.all([ref.current.materiais(), ref.current.meus()]); setMateriais(m); setPedidos(p); setStatus(""); }
    catch { setStatus("Não foi possível carregar agora. Tente de novo."); }
  }, []);
  useEffect(() => { const t = setTimeout(() => void carregar(), 0); return () => clearTimeout(t); }, [carregar]);
  const escolhido = materiais.find(m => m.item_id === item);
  async function enviar() {
    const q = lerQuantidade3t(quantidade);
    if (!item) { setStatus("Escolha o material."); return; }
    if (q === null) { setStatus("Quantidade inválida. Use um número de 1 a 1000."); return; }
    setEnviando(true); setStatus("");
    chave.current ??= crypto.randomUUID();
    try { await ref.current.pedir(item, q, obs.trim(), chave.current); chave.current = null; setItem(""); setQuantidade("1"); setObs("");
      setStatus("Pedido enviado. O escritório vai responder aqui."); await carregar(); }
    catch (e) { setStatus(/muitos_pedidos/.test(String(e instanceof Error ? e.message : e)) ? "Você já tem 10 pedidos esperando resposta. Aguarde o escritório." : "Não foi possível enviar. Tente de novo."); }
    finally { setEnviando(false); }
  }
  async function cancelar(id: number) {
    try { await ref.current.cancelar(id); setStatus("Pedido cancelado."); await carregar(); } catch { setStatus("Não foi possível cancelar."); }
  }
  return <section className={styles.records} aria-labelledby="pedir-material-title">
    <div className={styles.recordsHeading}><PackagePlus size={25} aria-hidden/><div><h2 id="pedir-material-title">Pedir material</h2><p>Peça o que você vai usar na obra. O escritório responde aqui.</p></div></div>
    <div className={styles.pedidoForm}>
      <label>Material<select value={item} onChange={e => setItem(e.target.value)}><option value="">Escolha…</option>
        {materiais.map(m => <option key={m.item_id} value={m.item_id}>{m.nome}{m.categoria ? ` (${m.categoria})` : ""}</option>)}</select></label>
      <label>Quantidade{escolhido ? ` (${escolhido.unidade})` : ""}<input inputMode="decimal" value={quantidade} onChange={e => setQuantidade(e.target.value)} maxLength={7}/></label>
      <label>Observação (opcional)<input value={obs} onChange={e => setObs(e.target.value)} maxLength={200} placeholder="Ex.: para a estrutura do galpão"/></label>
      <button type="button" className={styles.recordsDownload} disabled={enviando} onClick={() => void enviar()}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
    </div>
    <p role="status" aria-live="polite" className={styles.pointState}>{status}</p>
    <h3>Meus pedidos</h3>
    {!pedidos.length ? <p>Nenhum pedido ainda.</p> : <ul className={styles.pedidosLista}>{pedidos.map(p => <li key={p.id}>
      <div><strong>{p.quantidade.toLocaleString("pt-BR")} {p.unidade} · {p.material}</strong><small>{dia(p.created_at)} · {STATUS_PEDIDO_3T[p.status]}</small>
        {p.resposta && <p>Resposta: {p.resposta}</p>}</div>
      {p.status === "aberto" && <button type="button" className={styles.recordsButton} onClick={() => void cancelar(p.id)}>Cancelar</button>}
    </li>)}</ul>}
  </section>;
}
