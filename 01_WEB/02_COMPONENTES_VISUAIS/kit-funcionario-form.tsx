"use client";

import { useState } from "react";
import { saveEmployeeKit } from "@/app/actions/epi-completo";
import { OperationForm } from "@/02_COMPONENTES_VISUAIS/formulario-operacao";
export function EmployeeKitForm({ employeeId, items, initial }: {
  employeeId: string; items: Array<{ id: string; name: string; unit: string }>; initial: Record<string, number>;
}) {
  const [selected, setSelected] = useState(initial);
  return <OperationForm action={saveEmployeeKit} label="Salvar kit do funcionário">
    <input type="hidden" name="employeeId" value={employeeId} />
    <input type="hidden" name="lines" value={JSON.stringify(Object.entries(selected).map(([item_id, quantity]) => ({ item_id, quantity })))} />
    <p className="full muted">Marque os itens e suas quantidades previstas. Um kit vazio também pode ser salvo e substitui as recomendações da profissão.</p>
    {items.map((item) => <div className="kit-item full" key={item.id}>
      <label className="checkbox-field"><input type="checkbox" checked={Object.hasOwn(selected, item.id)} onChange={(e) => setSelected((old) => { const next = { ...old }; if (e.target.checked) next[item.id] = 1; else delete next[item.id]; return next; })} />{item.name}</label>
      {Object.hasOwn(selected, item.id) && <label>Quantidade ({item.unit})<input type="number" min={1} max={1000} required aria-label={`Quantidade prevista de ${item.name}`} value={selected[item.id]} onChange={(e) => setSelected({ ...selected, [item.id]: Number(e.target.value) })} /></label>}
    </div>)}
  </OperationForm>;
}
