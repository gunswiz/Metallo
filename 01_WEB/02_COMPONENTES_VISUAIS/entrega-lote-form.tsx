"use client";

import { useState } from "react";
import { deliverEpiBatch } from "@/app/actions/epi-completo";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
type Batch = { id: string; item_id: string; name: string; quantity: number; variant: string | null; lot_number: string | null; unit: string };
export function BatchDeliveryForm({ employees, batches, initialEmployee = "" }: {
  employees: Array<{ id: string; full_name: string }>; batches: Batch[]; initialEmployee?: string;
}) {
  const [lines, setLines] = useState<Array<{ stock_batch_id: string; item_id: string; quantity: number }>>([]);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState("");
  const batch = batches.find((entry) => entry.id === selected);
  function add() {
    if (!batch || !Number.isInteger(amount) || amount <= 0 || amount > Math.min(batch.quantity, 1000)) { setError("Confira o lote e a quantidade disponível."); return; }
    if (lines.some((line) => line.stock_batch_id === batch.id)) { setError("Este lote já está na lista. Remova a linha para alterar a quantidade."); return; }
    if (lines.length >= 100) { setError("Uma entrega pode conter até 100 lotes."); return; }
    setLines([...lines, { stock_batch_id: batch.id, item_id: batch.item_id, quantity: amount }]);
    setSelected(""); setAmount(1); setError("");
  }
  return <OperationForm action={deliverEpiBatch} label="Confirmar entrega dos itens" pendingLabel="Registrando entrega…">
    <label className="full">Funcionário<select name="employeeId" defaultValue={initialEmployee} required><option value="">Selecione</option>{employees.map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}</select></label>
    <input name="lines" type="hidden" value={JSON.stringify(lines)} />
    <label>Item / variante / lote<select aria-label="Lote a adicionar" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Selecione um lote</option>{batches.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.variant ?? "única"} · lote {entry.lot_number ?? entry.id.slice(0, 8)} · {entry.quantity} {entry.unit}</option>)}</select></label>
    <label>Quantidade a adicionar<input aria-label="Quantidade a adicionar" type="number" min={1} max={Math.min(batch?.quantity ?? 1000, 1000)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
    <div className="full"><button type="button" className="button secondary" onClick={add}>Adicionar à entrega</button></div>
    {error && <div className="alert error full" role="alert">{error}</div>}
    <div className="full list" aria-label="Itens da entrega">{lines.length === 0 ? <p className="muted">Adicione os itens antes de confirmar.</p> : lines.map((line) => {
      const entry = batches.find((candidate) => candidate.id === line.stock_batch_id)!;
      return <div className="list-row" key={line.stock_batch_id}><span>{entry.name} · {entry.variant ?? "única"} · {line.quantity} {entry.unit}</span><button type="button" className="button ghost" onClick={() => setLines(lines.filter((candidate) => candidate.stock_batch_id !== line.stock_batch_id))} aria-label={`Remover ${entry.name}`}>Remover</button></div>;
    })}</div>
    <label>Motivo<select name="reason" defaultValue="initial"><option value="initial">Primeira entrega</option><option value="replacement">Substituição</option><option value="additional">Adicional</option></select></label>
    <label>Observação<textarea name="note" maxLength={500} /></label>
  </OperationForm>;
}
