"use client";

import { useState } from "react";
import { requestEpi } from "@/app/actions/epi-completo";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
type Item = { id: string; name: string; system_key: string | null; code: string; epi_item_variants: Array<{ value: string; label: string }> };
type Employee = { id: string; full_name: string; shoe_size: string | null };
export function RequestEpiForm({ items, employees, initialEmployee = "", initialItem = "", initialQuantity = 1 }: {
  items: Item[]; employees: Employee[]; initialEmployee?: string; initialItem?: string; initialQuantity?: number;
}) {
  const [itemId, setItemId] = useState(initialItem);
  const [employeeId, setEmployeeId] = useState(initialEmployee);
  const item = items.find((entry) => entry.id === itemId);
  const employee = employees.find((entry) => entry.id === employeeId);
  const isBoot = (item?.system_key ?? item?.code)?.toUpperCase() === "EPI-BOT";
  const key = (item?.system_key ?? item?.code)?.toUpperCase();
  const fallback = isBoot ? Array.from({ length: 9 }, (_, i) => String(i + 38)) : key === "EPI-OCU" ? ["Claro", "Escuro"] : [];
  const variants = item?.epi_item_variants.length ? item.epi_item_variants : fallback.map((value) => ({ value, label: value }));
  return <OperationForm action={requestEpi} label="Registrar solicitação">
    <label>Funcionário<select name="employeeId" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}><option value="">Selecione</option>{employees.map((entry) => <option key={entry.id} value={entry.id}>{entry.full_name}</option>)}</select></label>
    <label>Item<select name="itemId" required value={itemId} onChange={(e) => setItemId(e.target.value)}><option value="">Selecione</option>{items.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    <label>Quantidade<input name="quantity" type="number" min={1} max={100} defaultValue={initialQuantity} required /></label>
    <label>Tamanho / variante{variants.length ? <select name="requestedVariant" key={`${itemId}:${employeeId}`} defaultValue={isBoot ? employee?.shoe_size ?? "" : ""} required><option value="">Selecione</option>{variants.map((variant) => <option key={variant.value} value={variant.value}>{variant.label}</option>)}</select> : <input name="requestedVariant" key={`${itemId}:${employeeId}`} defaultValue={isBoot ? employee?.shoe_size ?? "" : ""} required={isBoot} maxLength={80} placeholder="Quando aplicável" />}</label>
  </OperationForm>;
}
