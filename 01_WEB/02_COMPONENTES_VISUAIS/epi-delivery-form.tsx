"use client";

import { useState, type FormEvent } from "react";
import { localEventTime } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "./formulario-obra";
import Link from "next/link";
import { SubmitButton } from "@/02_COMPONENTES_VISUAIS/submit-button";

type Employee = { id: string; name: string; team: string; homeTeam?: string; worksiteId?: string | null };
type Batch = { id: string; itemId: string; itemName: string; itemCode: string; variant: string | null; quantity: number; unit: string; ca?: string | null; worksiteId?: string | null; location?: string };

export function EpiDeliveryForm({ action, submit, employees, batches, initialEmployee, initialItem }: { action?: (formData: FormData) => Promise<void>; submit?: SubmitOperation; employees: Employee[]; batches: Batch[]; initialEmployee?: string; initialItem?: string }) {
  const [employeeId,setEmployeeId]=useState(initialEmployee??"");
  const [batchId,setBatchId]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const employee=employees.find(person=>person.id===employeeId);
  const available=batches.filter(batch=>batch.quantity>0 && (!initialItem || batch.itemId===initialItem) && (batch.worksiteId==null || batch.worksiteId===employee?.worksiteId));
  const batch=available.find(batch=>batch.id===batchId);
  async function save(event:FormEvent<HTMLFormElement>) {
    if(!submit)return;
    event.preventDefault();
    if(busy||!batch||!employee)return;
    const values=new FormData(event.currentTarget);
    setBusy(true);setError("");
    try {
      await submit("deliver_epi",{employee_id:employeeId,lines:[{item_id:batch.itemId,stock_batch_id:batch.id,quantity:Number(values.get("quantity"))}],reason:String(values.get("reason")),note:String(values.get("note"))},String(values.get("eventTime")));
      setBatchId("");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível guardar a entrega.");}
    finally{setBusy(false);}
  }
  return (
    <form action={submit?undefined:action} onSubmit={submit?save:undefined} className="form-grid">
      <fieldset disabled={busy} className="form-grid full">
      <label className="full">Funcionário<select name="employeeId" value={employeeId} onChange={event=>{setEmployeeId(event.target.value);setBatchId("");}} required><option value="">Selecione</option>{employees.map(person=><option key={person.id} value={person.id}>{person.name} · trabalhando com {person.team}</option>)}</select></label>
      {employee&&<p className="full muted">Origem: {employee.homeTeam??employee.team} · Trabalhando com: {employee.team}</p>}
      <label className="full">Item, variante, C.A. e local do lote<select name="stockBatchId" value={batchId} onChange={(event) => setBatchId(event.target.value)} required disabled={!employee}><option value="">Selecione</option>{available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.itemName} · {candidate.variant ?? "Única"} · C.A. {candidate.ca??"não informado"} · {candidate.location??"Local não informado"} · {candidate.quantity} {candidate.unit}</option>)}</select></label>
      <input name="itemId" type="hidden" value={batch?.itemId ?? ""} />
      {employee&&!available.length&&<p className="alert full">Não há lote compatível disponível para este funcionário. Confira o local e o estoque.</p>}
      {batch && <div className="alert success full" role="status" aria-live="polite">{batch.itemName} ({batch.itemCode}) · {batch.location} · C.A. {batch.ca??"não informado"} · saldo {batch.quantity} {batch.unit}</div>}
      <label>Quantidade<input name="quantity" type="number" min="1" max={batch?.quantity ?? 1} defaultValue="1" required /></label>
      <label>Motivo<select name="reason" defaultValue="initial"><option value="initial">Primeira entrega</option><option value="replacement">Substituição</option><option value="additional">Adicional</option>{submit&&<><option value="wear">Desgaste</option><option value="lost">Perda</option><option value="damaged">Dano</option></>}</select></label>
      {submit&&<label>Quando aconteceu? (Fortaleza)<input name="eventTime" type="datetime-local" required defaultValue={localEventTime()}/></label>}
      <label className="full">Observação<textarea name="note" maxLength={500} /></label>
      <p className="muted full">O PDF para assinatura continua na ficha do funcionário. Na reposição, registre também o destino do EPI anterior em Itens atribuídos.</p>
      {error&&<p className="alert error full" role="alert">{error}</p>}
      <div className="form-actions">{!submit&&<Link className="button ghost" href="/epis">Cancelar</Link>}{submit?<button className="button primary" disabled={busy||!batch} type="submit">{busy?"Guardando…":"Confirmar entrega"}</button>:<SubmitButton pendingLabel="Entregando…">Confirmar entrega</SubmitButton>}</div>
      </fieldset>
    </form>
  );
}
