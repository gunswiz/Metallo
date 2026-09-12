"use client";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { SiteOperationForm, type SubmitOperation } from "./formulario-obra";
export function SiteEpiStockForms({
  data,
  teams,
  submit,
}: {
  data: SiteSnapshot;
  teams: SiteSnapshot["teams"];
  submit: SubmitOperation;
}) {
  const batchOptions = data.batches.map((b) => ({
    id: b.id,
    name: `${data.epi_items.find((i) => i.id === b.item_id)?.name ?? "Item"} · ${b.variant ?? "Única"} · ${data.works.find((w) => w.id === b.worksite_id)?.name ?? "COSEM / central"} · ${b.quantity} un`,
  }));
  return (
    <>
      <SiteOperationForm
        title="Compra de EPI entregue direto na obra"
        command="epi_entry"
        submit={submit}
        fields={[
          {
            name: "team_id",
            label: "Equipe / local que recebeu",
            type: "select",
            options: teams,
          },
          {
            name: "item_id",
            label: "Item recebido",
            type: "select",
            options: data.epi_items,
          },
          {
            name: "quantity",
            label: "Quantidade",
            type: "number",
            value: "1",
            max: 100000,
          },
          {
            name: "variant",
            label: "Tamanho / variante do catálogo",
            required: false,
          },
          {
            name: "ca_number",
            label: "C.A. (obrigatório para EPI)",
            required: false,
          },
          { name: "brand_model", label: "Marca / modelo", required: false },
          { name: "lot_number", label: "Lote", required: false },
        ]}
      />
      <SiteOperationForm
        title="Transferir EPI da COSEM ou entre obras"
        command="epi_transfer"
        submit={submit}
        fields={[
          {
            name: "stock_batch_id",
            label: "Lote de origem",
            type: "select",
            options: batchOptions,
          },
          {
            name: "team_id",
            label: "Equipe / obra de destino",
            type: "select",
            options: teams,
          },
          {
            name: "quantity",
            label: "Quantidade",
            type: "number",
            value: "1",
            max: 100000,
          },
        ]}
      />
    </>
  );
}
