"use client";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { can, canOperateTeam, formatDateTime } from "@metallo/core";
import { orderStatusLabels } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import { SiteOperationForm } from "../formulario-obra";
import { siteFields } from "./campos";
export function LocacoesObra({
  data,
  profile,
  submit,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
}) {
  const { teamName, note } = siteFields(data, profile);
  const admin = profile.role === "admin";
  return data.assets
    .filter((a) => a.ownership === "rented")
    .map((asset) => {
      const details = data.rental_details.find((d) => d.asset_id === asset.id);
      return (
        <section className="panel" key={asset.id}>
          <header className="panel-header">
            <div>
              <h2>
                {asset.name} · {asset.number ?? asset.code}
              </h2>
              <p>
                {asset.company} · {teamName(asset.team_id)} ·{" "}
                {asset.active ? "Na empresa" : "Devolvida"}
              </p>
            </div>
          </header>
          <div className="panel-body">
            {asset.active &&
              can(profile, "rentals:write") &&
              canOperateTeam(profile, asset.team_id) &&
              !data.rental_returns.some(
                (r) =>
                  r.asset_id === asset.id &&
                  ["pending", "arranged"].includes(r.status),
              ) && (
                <SiteOperationForm
                  title="Avisar à ADM que não precisamos mais"
                  command="rental_notify"
                  submit={submit}
                  fixed={{ asset_id: asset.id }}
                  fields={[
                    {
                      ...note,
                      required: true,
                      label: "Motivo / informação para a ADM",
                    },
                  ]}
                />
              )}
            {data.rental_returns
              .filter((r) => r.asset_id === asset.id)
              .map((r) => (
                <div key={r.id}>
                  <p>
                    <b>{orderStatusLabels[r.status]}</b> · {r.note} ·{" "}
                    {formatDateTime(r.occurred_at)}
                  </p>
                  {admin && ["pending", "arranged"].includes(r.status) && (
                    <SiteOperationForm
                      title="ADM: registrar providência"
                      command="rental_resolve"
                      submit={submit}
                      fixed={{ request_id: r.id }}
                      fields={[
                        {
                          name: "status",
                          label: "Providência",
                          type: "select",
                          options: [
                            {
                              id: "arranged",
                              name: "Devolução combinada",
                            },
                            {
                              id: "returned",
                              name: "Entregue à locadora",
                            },
                            {
                              id: "cancelled",
                              name: "Manter a máquina",
                            },
                          ],
                        },
                        note,
                      ]}
                    />
                  )}
                </div>
              ))}
            {admin && (
              <>
                <p>
                  Valor: {details?.amount ?? "Não informado"} · Cobrança
                  encerrada:{" "}
                  {details?.billing_closed_on ??
                    "Ainda não confirmada pela ADM"}
                </p>
                <SiteOperationForm
                  title="ADM: valores e datas da locação"
                  command="rental_details"
                  submit={submit}
                  fixed={{ asset_id: asset.id }}
                  fields={[
                    {
                      name: "amount",
                      label: "Valor contratado (R$)",
                      type: "number",
                      required: false,
                      value: details?.amount?.toString(),
                    },
                    {
                      name: "billing_period",
                      label: "Período da cobrança",
                      type: "select",
                      required: false,
                      value: details?.billing_period ?? "",
                      options: [
                        { id: "day", name: "Diária" },
                        { id: "week", name: "Semanal" },
                        { id: "month", name: "Mensal" },
                        { id: "contract", name: "Contrato" },
                      ],
                    },
                    {
                      name: "expected_return",
                      label: "Previsão de devolução",
                      type: "date",
                      required: false,
                      value: details?.expected_return ?? "",
                    },
                    {
                      name: "billing_closed_on",
                      label: "Encerramento confirmado da cobrança",
                      type: "date",
                      required: false,
                      value: details?.billing_closed_on ?? "",
                    },
                    { ...note, value: details?.note ?? "" },
                  ]}
                >
                  <p className="full muted">
                    Preencha somente as informações confirmadas com a locadora.
                    O aviso da obra não encerra a cobrança.
                  </p>
                </SiteOperationForm>
              </>
            )}
          </div>
        </section>
      );
    });
}
