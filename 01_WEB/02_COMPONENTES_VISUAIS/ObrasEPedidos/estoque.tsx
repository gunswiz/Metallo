"use client";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { can, canOperateTeam } from "@metallo/core";
import { SiteOperationForm } from "../formulario-obra";
import { SiteEpiStockForms } from "../estoque-epi-obra";
import { siteFields } from "./campos";
export function EstoqueObra({
  data,
  profile,
  submit,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
}) {
  const { teamName, workName, allowedTeams, teamField, note, quantity } =
    siteFields(data, profile);
  return (
    <>
      {can(profile, "epi:write") && (
        <SiteEpiStockForms data={data} teams={allowedTeams} submit={submit} />
      )}
      <section className="panel">
        <header className="panel-header">
          <h2>Estoque compartilhado por obra</h2>
        </header>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Obra / local</th>
                <th>Material</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.materials.flatMap((item) =>
                item.stock.map((stock) => (
                  <tr key={`${item.id}-${stock.team_id}`}>
                    <td>
                      {data.works.find((w) => w.stock_team_id === stock.team_id)
                        ?.name ?? teamName(stock.team_id)}
                    </td>
                    <td>{item.name}</td>
                    <td>
                      {stock.quantity} {item.unit}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
      {can(profile, "consumption:write") && (
        <SiteOperationForm
          title="Registrar consumo diário"
          command="consume"
          submit={submit}
          fields={[
            teamField,
            {
              name: "item_id",
              label: "Material consumido",
              type: "select",
              options: data.materials,
            },
            quantity,
            note,
          ]}
        />
      )}
      {can(profile, "materials:write") && (
        <SiteOperationForm
          title="Registrar compra entregue direto na obra"
          command="material_entry"
          submit={submit}
          fields={[
            teamField,
            {
              name: "item_id",
              label: "Material recebido",
              type: "select",
              options: data.materials,
            },
            quantity,
            note,
          ]}
        />
      )}
      {can(profile, "equipment:write") && (
        <SiteOperationForm
          title="Transferir equipamento para outra equipe"
          command="transfer_equipment"
          submit={submit}
          fields={[
            {
              name: "asset_id",
              label: "Equipamento",
              type: "select",
              options: data.assets
                .filter((a) => a.active && canOperateTeam(profile, a.team_id))
                .map((a) => ({
                  id: a.id,
                  name: `${a.name} · ${a.code} · ${teamName(a.team_id)}`,
                })),
            },
            {
              ...teamField,
              label: "Equipe de destino",
              options: data.teams,
            },
            note,
          ]}
        />
      )}
      {can(profile, "epi:write") && (
        <>
          <SiteOperationForm
            title="Registrar entrega individual de EPI"
            command="deliver_epi"
            submit={submit}
            fields={[
              {
                name: "employee_id",
                label: "Funcionário",
                type: "select",
                options: data.employees,
              },
              {
                name: "delivery_batch",
                label: "Item / lote / local",
                type: "select",
                options: data.batches.map((b) => ({
                  id: `${b.id}|${b.item_id}`,
                  name: `${data.epi_items.find((i) => i.id === b.item_id)?.name ?? "Item"} · ${b.variant ?? "única"} · CA ${b.ca_number ?? "não informado"} · ${workName(b.worksite_id)} · ${b.quantity} un`,
                })),
              },
              quantity,
              {
                name: "reason",
                label: "Motivo",
                type: "select",
                options: [
                  { id: "initial", name: "Primeira entrega" },
                  { id: "additional", name: "Adicional" },
                  { id: "wear", name: "Desgaste" },
                  { id: "lost", name: "Perda" },
                  { id: "damaged", name: "Dano" },
                ],
              },
              note,
            ]}
          />
          <p>
            Na substituição, registre também o destino do item anterior em
            Funcionários → funcionário → itens atribuídos.
          </p>
          <section className="panel">
            <header className="panel-header">
              <h2>Lotes de EPI</h2>
            </header>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Local</th>
                    <th>Item</th>
                    <th>Variante / C.A.</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b) => (
                    <tr key={b.id}>
                      <td>{workName(b.worksite_id)}</td>
                      <td>
                        {data.epi_items.find((i) => i.id === b.item_id)?.name}
                      </td>
                      <td>
                        {b.variant ?? "Única"} ·{" "}
                        {b.ca_number ?? "Não informado"}
                      </td>
                      <td>{b.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
