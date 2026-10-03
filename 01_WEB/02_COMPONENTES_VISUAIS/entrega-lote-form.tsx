"use client";

import { useState, type FormEvent } from "react";
import { localEventTime } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "./formulario-obra";
import { deliverEpiBatch } from "@/app/actions/epi-completo";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
type Batch = { id: string; item_id: string; name: string; quantity: number; variant: string | null; lot_number: string | null; unit: string; worksite_id?: string | null; ca_number?: string | null; location?: string };
export function BatchDeliveryForm({ employees, batches, initialEmployee = "", submit }: {
  employees: Array<{ id: string; full_name: string; worksite_id?: string | null; team?: string }>; batches: Batch[]; initialEmployee?: string; submit?: SubmitOperation;
}) {
  const [employeeId, setEmployeeId] = useState(initialEmployee);
  const [busy,setBusy] = useState(false);
  const employee=employees.find(person=>person.id===employeeId);
  const available=batches.filter(batch=>batch.worksite_id==null||batch.worksite_id===employee?.worksite_id);
  const [lines, setLines] = useState<Array<{ stock_batch_id: string; item_id: string; quantity: number }>>([]);
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState("");
  const batch = available.find((entry) => entry.id === selected);
  function add() {
    if (!batch || !Number.isInteger(amount) || amount <= 0 || amount > Math.min(batch.quantity, 1000)) { setError("Confira o lote e a quantidade disponível."); return; }
    if (lines.some((line) => line.stock_batch_id === batch.id)) { setError("Este lote já está na lista. Remova a linha para alterar a quantidade."); return; }
    if (lines.length >= 100) { setError("Uma entrega pode conter até 100 lotes."); return; }
    setLines([...lines, { stock_batch_id: batch.id, item_id: batch.item_id, quantity: amount }]);
    setSelected(""); setAmount(1); setError("");
  }
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!submit||busy||!lines.length)return;
    const values=new FormData(event.currentTarget);setBusy(true);setError("");
    try{await submit("deliver_epi",{employee_id:employeeId,lines,reason:String(values.get("reason")),note:String(values.get("note"))},String(values.get("eventTime")));setLines([]);}
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível guardar a entrega.");}finally{setBusy(false);}
  }
  const fields=<>
    <label className="full">Funcionário<select name="employeeId" value={employeeId} onChange={event=>{setEmployeeId(event.target.value);setSelected("");setLines([]);}} required><option value="">Selecione</option>{employees.map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name} · {entry.team}</option>)}</select></label>
    <input name="lines" type="hidden" value={JSON.stringify(lines)} />
    <label>Item / variante / lote<select aria-label="Lote a adicionar" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Selecione um lote</option>{available.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.location??"Local não informado"} · C.A. {entry.ca_number??"não informado"} · {entry.variant ?? "única"} · lote {entry.lot_number ?? entry.id.slice(0, 8)} · {entry.quantity} {entry.unit}</option>)}</select></label>
    <label>Quantidade a adicionar<input aria-label="Quantidade a adicionar" type="number" min={1} max={Math.min(batch?.quantity ?? 1000, 1000)} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
    <div className="full"><button type="button" className="button secondary" onClick={add}>Adicionar à entrega</button></div>
    {error && <div className="alert error full" role="alert">{error}</div>}
    <div className="full list" aria-label="Itens da entrega">{lines.length === 0 ? <p className="muted">Adicione os itens antes de confirmar.</p> : lines.map((line) => {
      const entry = batches.find((candidate) => candidate.id === line.stock_batch_id)!;
      return <div className="list-row" key={line.stock_batch_id}><span>{entry.name} · {entry.variant ?? "única"} · {line.quantity} {entry.unit}</span><button type="button" className="button ghost" onClick={() => setLines(lines.filter((candidate) => candidate.stock_batch_id !== line.stock_batch_id))} aria-label={`Remover ${entry.name}`}>Remover</button></div>;
    })}</div>
    <label>Motivo<select name="reason" defaultValue="initial"><option value="initial">Primeira entrega</option><option value="replacement">Substituição</option><option value="additional">Adicional</option></select></label>
    {submit&&<label>Quando aconteceu? (Fortaleza)<input name="eventTime" type="datetime-local" required defaultValue={localEventTime()}/></label>}
    <label>Observação<textarea name="note" maxLength={500} /></label>
  </>;
  return submit?<form className="form-grid" onSubmit={save}><fieldset className="form-grid full" disabled={busy}>{fields}<div className="form-actions"><button className="button primary" type="submit" disabled={busy||!lines.length||!employeeId}>{busy?"Guardando…":"Confirmar entrega dos itens"}</button></div></fieldset></form>:<OperationForm action={deliverEpiBatch} label="Confirmar entrega dos itens" pendingLabel="Registrando entrega…">{fields}</OperationForm>;
}
