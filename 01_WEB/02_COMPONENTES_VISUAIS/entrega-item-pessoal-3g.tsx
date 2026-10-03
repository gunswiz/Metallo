"use client";

import { useState } from "react";

type Item = { id: string; name: string; code: string; unit: string };
type Batch = { id: string; item_id: string; quantity: number; variant: string | null;
  lot_number: string | null; worksite_id: string | null };

export function PersonalItemDeliveryFields3g({ catalog, batches, allowExceptional = false }: {
  catalog: Item[]; batches: Batch[]; allowExceptional?: boolean;
}) {
  const [itemId, setItemId] = useState("");
  const [origin, setOrigin] = useState<"STOCK_BATCH" | "WITHOUT_STOCK">("STOCK_BATCH");
  const [exceptionReason, setExceptionReason] = useState("");
  const [batchId, setBatchId] = useState("");
  const available = batches.filter(batch => batch.item_id === itemId);
  const selected = available.find(batch => batch.id === batchId);
  const item = catalog.find(entry => entry.id === itemId);
  return <>
    <label>Item do catálogo<select name="itemId" required value={itemId} onChange={event => {
      setItemId(event.target.value); setBatchId("");
    }}><option value="" disabled>Selecione</option>{catalog.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.code}</option>)}</select></label>
    <label>Origem da entrega<select name="stockOrigin" value={origin} onChange={event => {
      setOrigin(event.target.value as typeof origin); setBatchId("");
    }}><option value="STOCK_BATCH">Sai do estoque Metallo</option>
      {allowExceptional && <option value="WITHOUT_STOCK">Entrega excepcional sem vínculo com estoque</option>}</select></label>
    {origin === "STOCK_BATCH" ? <>
      <label className="full">Lote disponível<select name="stockBatchId" required value={batchId}
        onChange={event => setBatchId(event.target.value)} disabled={!itemId}>
        <option value="">Selecione o lote</option>{available.map(batch => <option key={batch.id} value={batch.id}>
          {item?.name} · {batch.variant ?? "variante única"} · {batch.lot_number ? `lote ${batch.lot_number}` : "sem número de lote"} · {batch.worksite_id ? "obra" : "central"} · disponível: {batch.quantity} {item?.unit}
        </option>)}</select></label>
      {itemId && <p className="muted full" role="status">{selected
        ? `Disponível neste lote: ${selected.quantity} ${item?.unit}. A saída será registrada junto com a entrega.`
        : available.length ? "Escolha o lote de onde o item realmente sairá."
          : "Não há lote disponível para este item. Escolha outro item ou consulte o administrador sobre uma entrega excepcional."}</p>}
      <input type="hidden" name="variant" value={selected?.variant ?? ""}/>
    </> : <>
      <input type="hidden" name="stockBatchId" value=""/>
      <label>Medida / variante opcional<input name="variant" maxLength={80} placeholder="Ex.: 5 m"/></label>
      <label>Motivo da exceção<select name="exceptionReason" required value={exceptionReason}
        onChange={event => setExceptionReason(event.target.value)}>
        <option value="" disabled>Selecione o motivo</option>
        <option value="EXTERNAL_SUPPLY">Item fornecido externamente</option>
        <option value="UNTRACKED_LEGACY_STOCK">Estoque legado não rastreado</option>
        <option value="AUTHORIZED_OPERATIONAL_ADJUSTMENT">Ajuste operacional autorizado</option>
        <option value="OTHER">Outro motivo</option>
      </select></label>
      <p className="muted full">Esta entrega não realizará baixa de lote de estoque.</p>
      <label className="full"><input name="exceptionConfirmed" type="checkbox" value="yes" required/>
        Confirmo que esta entrega excepcional não realizará baixa de lote de estoque.</label>
    </>}
    <label>Quantidade<input name="quantity" type="number" min="1" max={selected?.quantity ?? 1000}
      defaultValue="1" required/></label>
    <label className="full">{origin === "WITHOUT_STOCK" ? "Observação (obrigatória para Outro motivo)" : "Observação interna opcional"}
      <textarea name="note" maxLength={240} rows={2}
        required={origin === "WITHOUT_STOCK" && exceptionReason === "OTHER"}/></label>
  </>;
}
