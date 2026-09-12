"use client";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { SiteOperationForm } from "../formulario-obra";
import { siteFields } from "./campos";
export function CadastroObras({
  data,
  profile,
  submit,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
}) {
  const { teamName, teamField } = siteFields(data, profile);
  return (
    <>
      <SiteOperationForm
        title="Cadastrar obra e definir seu estoque"
        command="create_worksite"
        submit={submit}
        fields={[
          { name: "name", label: "Nome da obra" },
          {
            ...teamField,
            label: "Equipe / local que guarda o estoque",
            options: data.teams.filter((t) => !t.worksite_id && !t.central),
          },
        ]}
      />
      <SiteOperationForm
        title="Vincular mais uma equipe à obra"
        command="link_team"
        submit={submit}
        fields={[
          {
            name: "worksite_id",
            label: "Obra",
            type: "select",
            options: data.works.filter((w) => w.active),
          },
          {
            ...teamField,
            options: data.teams.filter(
              (t) => !data.works.some((w) => w.stock_team_id === t.id),
            ),
          },
        ]}
      >
        <p className="full muted">
          Os saldos ainda separados desta equipe serão somados ao estoque da
          obra, com registro no histórico.
        </p>
      </SiteOperationForm>
      {data.works.map((w) => (
        <section className="panel" key={w.id}>
          <div className="panel-body">
            <h2>{w.name}</h2>
            <p>{w.active ? "Obra em andamento" : "Obra encerrada"}</p>
            <SiteOperationForm
              title={w.active ? "Encerrar obra" : "Reabrir obra"}
              command="set_worksite_status"
              fields={[]}
              fixed={{ worksite_id: w.id, active: !w.active }}
              submit={submit}
            />
            <p>Estoque: {teamName(w.stock_team_id)}</p>
            <p>
              Equipes:{" "}
              {data.teams
                .filter((t) => t.worksite_id === w.id)
                .map((t) => t.name)
                .join(", ")}
            </p>
          </div>
        </section>
      ))}
    </>
  );
}
