"use client";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { formatDateTime } from "@metallo/core";
import { SiteOperationForm } from "../formulario-obra";
import { siteFields } from "./campos";
export function FuncionariosObra({
  data,
  profile,
  submit,
}: {
  data: SiteSnapshot;
  profile: SessionProfile;
  submit: SubmitOperation;
}) {
  const { teamName, teamField, note } = siteFields(data, profile);
  const admin = profile.role === "admin";
  return (
    <>
      <section className="panel">
        <header className="panel-header">
          <h2>Equipe de origem e local de apoio</h2>
        </header>
        <div className="panel-body">
          {data.employees.map((e) => (
            <div className="list-row" key={e.id}>
              <span>
                <strong>{e.name}</strong>
                <br />
                Origem: {teamName(e.home_team_id)} · Trabalhando com:{" "}
                {teamName(e.team_id)}
              </span>
              <a className="button secondary" href={`/funcionarios/${e.id}`}>
                Abrir funcionário / PDF
              </a>
            </div>
          ))}
        </div>
      </section>
      {admin && (
        <SiteOperationForm
          title="Registrar funcionário ajudando outra equipe"
          command="assign_employee"
          submit={submit}
          fields={[
            {
              name: "employee_id",
              label: "Funcionário",
              type: "select",
              options: data.employees,
            },
            {
              ...teamField,
              label: "Equipe em que vai ajudar",
              options: data.teams,
            },
            {
              name: "ends_at",
              label: "Fim previsto (opcional)",
              type: "date",
              required: false,
            },
            note,
          ]}
        />
      )}
      {data.assignments
        .filter((a) => !a.ends_at || new Date(a.ends_at) > new Date())
        .map((a) => (
          <section className="panel" key={a.id}>
            <div className="panel-body">
              <p>
                {data.employees.find((e) => e.id === a.employee_id)?.name} ·{" "}
                {teamName(a.team_id)} · desde {formatDateTime(a.starts_at)}
              </p>
              {admin && (
                <SiteOperationForm
                  title="Encerrar apoio e retornar à equipe de origem"
                  command="end_assignment"
                  fixed={{ assignment_id: a.id }}
                  fields={[]}
                  submit={submit}
                />
              )}
            </div>
          </section>
        ))}
    </>
  );
}
