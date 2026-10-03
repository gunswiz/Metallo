"use client";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { can, canOperateTeam, formatDateTime } from "@metallo/core";
import {
  orderStatusLabels,
  orderTransitions,
} from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { SiteOperationForm } from "../formulario-obra";
import { OrderReceipt } from "../operacoes-integradas";
import { SiteOrderForm } from "../pedido-obra-form";
import { siteFields } from "./campos";
export function PedidosObra({
  data,
  profile,
  submit,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
}) {
  const { teamName, allowedTeams, note } = siteFields(data, profile);
  const admin = profile.role === "admin";
  return (
    <>
      {can(profile, "requests:write") && (
        <SiteOrderForm
          data={data}
          teams={allowedTeams}
          submit={submit}
          canPurchase={can(profile, "requests:write")}
          canRent={can(profile, "rentals:write")}
        />
      )}
      {!can(profile, "requests:write") && can(profile, "rentals:write") && (
        <p className="muted">Registre as máquinas na área Máquinas alugadas quando a necessidade surgir.</p>
      )}
      {data.orders.map((order) => (
        <section className="panel" key={order.id}>
          <header className="panel-header">
            <div>
              <h2>
                {teamName(order.team_id)} · {orderStatusLabels[order.status]}
              </h2>
              <p>
                Pedido {order.id.slice(0, 8)} · solicitado em{" "}
                {formatDateTime(order.occurred_at)} · registrado em{" "}
                {formatDateTime(order.created_at)}
              </p>
              {order.note && <p>{order.note}</p>}
            </div>
          </header>
          <div className="panel-body">
            {order.lines.map((line) => (
              <div className="order-line" key={line.id}>
                <strong>
                  {line.description} {line.variant && `· ${line.variant}`}
                </strong>
                <p>
                  Pedido: {line.quantity} · Recebido: {line.received_quantity} ·{" "}
                  <b>Falta: {line.quantity - line.received_quantity}</b>
                </p>
                {["ordered", "partial"].includes(order.status) &&
                  line.received_quantity < line.quantity &&
                  canOperateTeam(profile, order.team_id) && can(
                    profile,
                    line.kind === "rental" ? "rentals:write" : "requests:write",
                  ) && (
                    <OrderReceipt order={order} line={line} submit={submit} />                  )}
              </div>
            ))}
            {admin && (orderTransitions[order.status]?.length ?? 0) > 0 && (
              <SiteOperationForm
                title="ADM: atualizar etapa do pedido"
                command="order_status"
                fixed={{ order_id: order.id }}
                submit={submit}
                fields={[
                  {
                    name: "status",
                    label: "Nova etapa",
                    type: "select",
                    options: orderTransitions[order.status].map((id) => ({
                      id,
                      name: orderStatusLabels[id],
                    })),
                  },
                  note,
                ]}
              >
                <p className="muted full">
                  Marque “Aprovado” depois de receber a aprovação do patrão.
                </p>
              </SiteOperationForm>
            )}
            <details>
              <summary>Histórico do pedido</summary>
              {order.events.map((e) => (
                <p key={e.id}>
                  {orderStatusLabels[e.event] ?? e.event}
                  {e.quantity ? ` · ${e.quantity} un` : ""} · fato:{" "}
                  {formatDateTime(e.occurred_at)} · lançamento:{" "}
                  {formatDateTime(e.recorded_at)} {e.note}
                </p>
              ))}
            </details>
          </div>
        </section>
      ))}
    </>
  );
}
