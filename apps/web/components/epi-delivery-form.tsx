"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";

type Employee = { id: string; name: string; team: string };
type Batch = { id: string; itemId: string; itemName: string; itemCode: string; variant: string | null; quantity: number; unit: string };

export function EpiDeliveryForm({ action, employees, batches, initialEmployee, initialItem }: { action: (formData: FormData) => Promise<void>; employees: Employee[]; batches: Batch[]; initialEmployee?: string; initialItem?: string }) {
  const initialBatch = batches.find((candidate) => candidate.itemId === initialItem)?.id ?? "";
  const [batchId, setBatchId] = useState(initialBatch);
  const batch = useMemo(() => batches.find((candidate) => candidate.id === batchId), [batchId, batches]);
  return (
    <form action={action} className="form-grid">
      <label className="full">Funcionário<select name="employeeId" defaultValue={initialEmployee ?? ""} required><option value="" disabled>Selecione</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.team}</option>)}</select></label>
      <label className="full">Item, variante e lote disponível<select name="stockBatchId" value={batchId} onChange={(event) => setBatchId(event.target.value)} required><option value="" disabled>Selecione</option>{batches.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.itemName} · {candidate.variant ?? "sem variante"} · {candidate.quantity} {candidate.unit} disponíveis</option>)}</select></label>
      <input name="itemId" type="hidden" value={batch?.itemId ?? ""} />
      {batch && <div className="alert success full">Selecionado: {batch.itemName} ({batch.itemCode}) · disponível {batch.quantity} {batch.unit}</div>}
      <label>Quantidade<input name="quantity" type="number" min="1" max={batch?.quantity ?? 1} defaultValue="1" required /></label>
      <label>Motivo<select name="reason" defaultValue="initial"><option value="initial">Primeira entrega</option><option value="replacement">Substituição</option><option value="additional">Adicional</option></select></label>
      <label className="full">Observação<textarea name="note" maxLength={500} /></label>
      <div className="form-actions"><Link className="button ghost" href="/epis">Cancelar</Link><SubmitButton pendingLabel="Entregando…">Confirmar entrega</SubmitButton></div>
    </form>
  );
}
