"use client";

import { useState } from "react";
import { prepareEpiKit3d } from "@/app/actions/epi-completo";
import { OperationForm } from "./formulario-operacao";

type Batch = { id: string; item_id: string; name: string; unit: string; quantity: number; variant: string | null; ca_number: string | null };
type Suggestion = { item_id: string; item_name: string; unit: string; recommended_quantity: number };
type Exchange = { request_id: string; item_id: string; item_name: string; delivery_group_id: string | null };
type Line = { item_id: string; stock_batch_id: string; quantity: number };

export function EpiPreparacao3d({ employeeId, employeeName, batches, suggestion, approved, keyId }:
  { employeeId: string; employeeName: string; batches: Batch[]; suggestion: Suggestion[]; approved: Exchange[]; keyId: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [chosen, setChosen] = useState("");
  const [amount, setAmount] = useState(1);
  const [exchangeId, setExchangeId] = useState("");
  const [notice, setNotice] = useState("");
  const batch = batches.find(entry => entry.id === chosen);
  const exchangeItemId = approved.find(request => request.request_id === exchangeId)?.item_id;
  function suggest() {
    const next: Line[] = [];
    for (const entry of suggestion.filter(item => !exchangeId || item.item_id === exchangeItemId)) {
      const available = batches.find(candidate => candidate.item_id === entry.item_id && candidate.quantity >= entry.recommended_quantity);
      if (available && !next.some(line => line.stock_batch_id === available.id))
        next.push({ item_id: entry.item_id, stock_batch_id: available.id, quantity: entry.recommended_quantity });
    }
    setLines(next);
    setNotice(next.length === suggestion.filter(item => !exchangeId || item.item_id === exchangeItemId).length ? "Sugestão carregada. Revise cada item, tamanho e quantidade antes de preparar." :
      "Sugestão parcial: alguns itens não possuem lote com saldo suficiente. Revise e complete manualmente.");
  }
  function add() {
    if (!batch || !Number.isInteger(amount) || amount < 1 || amount > Math.min(batch.quantity, 100) || lines.some(line => line.stock_batch_id === batch.id) || lines.length >= 30) {
      setNotice("Confira o lote, a quantidade e se o item já foi adicionado."); return;
    }
    setLines([...lines, { item_id: batch.item_id, stock_batch_id: batch.id, quantity: amount }]);
    setChosen(""); setAmount(1); setNotice("");
  }
  return <div className="panel-body">
    <h3>Preparar kit para {employeeName}</h3>
    <p>O kit é uma sugestão configurada pela empresa. A Gestão revisa os itens. Preparar não registra entrega nem baixa estoque.</p>
    {suggestion.length > 0 ? <button type="button" className="button secondary" onClick={suggest}>Carregar sugestão da função</button> : <p className="muted">Sem sugestão de EPI configurada para esta função. Adicione itens manualmente.</p>}
    {notice && <p role="status" className="alert">{notice}</p>}
    <OperationForm action={prepareEpiKit3d} label="Preparar kit" pendingLabel="Preparando…">
      <input type="hidden" name="employeeId" value={employeeId}/>
      <input type="hidden" name="idempotencyKey" value={keyId}/>
      <input type="hidden" name="lines" value={JSON.stringify(lines)}/>
      <label className="full">Solicitação de troca aprovada (opcional)
        <select name="exchangeRequestId" value={exchangeId} onChange={event => { setExchangeId(event.target.value); setLines([]); }}>
          <option value="">Nova entrega sem troca 3C</option>
          {approved.filter(entry => !entry.delivery_group_id).map(entry => <option key={entry.request_id} value={entry.request_id}>{entry.item_name} · pedido {entry.request_id.slice(0,8)}</option>)}
        </select>
      </label>
      {exchangeId && <p className="muted full">Para esta troca, selecione apenas lote do mesmo EPI do pedido aprovado. O EPI anterior permanece ativo até decisão explícita de destino.</p>}
      <label>Item, tamanho, CA e lote
        <select aria-label="Lote para preparar" value={chosen} onChange={event => setChosen(event.target.value)}>
          <option value="">Selecione</option>
          {batches.filter(entry => !exchangeId || exchangeItemId === entry.item_id)
            .map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.variant ?? "variante única"} · CA {entry.ca_number ?? "não informado"} · {entry.quantity} {entry.unit} disponíveis</option>)}
        </select>
      </label>
      <label>Quantidade<input type="number" min="1" max={Math.min(batch?.quantity ?? 100,100)} value={amount} onChange={event => setAmount(Number(event.target.value))}/></label>
      <div className="full"><button type="button" className="button secondary" onClick={add}>Adicionar item</button></div>
      <div className="full list" aria-label="Resumo do kit para revisão">
        {lines.length === 0 ? <p className="muted">Nenhum item adicionado.</p> : lines.map(line => {
          const entry = batches.find(candidate => candidate.id === line.stock_batch_id)!;
          return <div className="list-row" key={line.stock_batch_id}><span>{entry.name} · {entry.variant ?? "variante única"} · CA {entry.ca_number ?? "não informado"} · {line.quantity} {entry.unit}</span>
            <button type="button" className="button ghost" onClick={() => setLines(lines.filter(candidate => candidate.stock_batch_id !== line.stock_batch_id))}>Remover</button></div>;
        })}
      </div>
      <p className="muted full">Esta ação só registra a separação do kit. Após a entrega física, use “Registrar entrega” na lista de kits preparados.</p>
    </OperationForm>
  </div>;
}
