"use client";
import { useState } from "react";
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
  showForm = true,
  showOrders = true,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
  // Marco 3K: "Pedir à ADM" (só o formulário) e "Pedidos à ADM" (só a lista) são telas separadas.
  showForm?: boolean;
  showOrders?: boolean;
}) {
  const { teamName, allowedTeams, note } = siteFields(data, profile);
  const admin = profile.role === "admin";
  const [filtro, setFiltro] = useState<"abertos" | "concluidos" | "todos">("abertos");
  const finais = ["received", "rejected", "cancelled", "returned"];
  const orders = data.orders.filter(order => filtro === "todos" || (filtro === "abertos") !== finais.includes(order.status));
  const contagem = { abertos: data.orders.filter(order => !finais.includes(order.status)).length, concluidos: data.orders.filter(order => finais.includes(order.status)).length, todos: data.orders.length };
  return (
    <>
      {showForm && can(profile, "requests:write") && (
        <SiteOrderForm
          data={data}
          teams={allowedTeams}
          submit={submit}
          canPurchase={can(profile, "requests:write")}
          canRent={can(profile, "rentals:write")}
        />
      )}
      {showForm && !can(profile, "requests:write") && can(profile, "rentals:write") && (
        <p className="muted">Registre as máquinas na área Máquinas alugadas quando a necessidade surgir.</p>
      )}
      {showOrders && <div className="module-tabs" role="group" aria-label="Filtrar pedidos">{(["abertos", "concluidos", "todos"] as const).map(id =>
        <button key={id} type="button" className={filtro === id ? "button primary" : "button ghost"} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
          {{ abertos: "Em andamento", concluidos: "Concluídos", todos: "Todos" }[id]} ({contagem[id]})</button>)}</div>}
      {showOrders && orders.length === 0 && <p className="muted">{filtro === "abertos" ? "Nenhum pedido em andamento." : "Nenhum pedido neste filtro."}</p>}
      {showOrders && orders.map((order) => (
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
