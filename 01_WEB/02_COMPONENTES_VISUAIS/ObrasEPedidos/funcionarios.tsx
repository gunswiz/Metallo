"use client";
import { useState } from "react";
import Link from "next/link";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { SubmitOperation } from "../formulario-obra";
import { SiteOperationForm } from "../formulario-obra";
import { siteFields } from "./campos";

const dia = (valor: string | null) => valor ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short" }).format(new Date(valor)) : "sem data de fim";

// Marco 3L: primeiro quem está de fato em apoio (tabela), depois a lista completa recolhida.
export function FuncionariosObra({ data, profile, submit }: { data: SiteSnapshot; profile: SessionProfile; submit: SubmitOperation }) {
  const { teamName, teamField, note } = siteFields(data, profile);
  const admin = profile.role === "admin";
  const [agora] = useState(() => Date.now());
  const nome = (id: string) => data.employees.find((e) => e.id === id);
  const apoios = data.assignments
    .filter((a) => !a.ends_at || new Date(a.ends_at).getTime() > agora)
    .sort((a, b) => (nome(a.employee_id)?.name ?? "").localeCompare(nome(b.employee_id)?.name ?? "", "pt-BR"));
  return <>
    <section className="panel">
      <header className="panel-header"><div><h2>Em apoio agora ({apoios.length})</h2><p>Funcionários ajudando uma equipe diferente da sua.</p></div></header>
      {apoios.length === 0 ? <div className="panel-body"><p className="muted">Ninguém está ajudando outra equipe agora.</p></div> :
        <div className="data-table-wrap"><table className="data-table apoio-tabela">
          <thead><tr><th>Funcionário</th><th>Equipe de origem</th><th>Ajudando</th><th>Desde</th><th>Até</th><th>Ações</th></tr></thead>
          <tbody>{apoios.map((a) => { const pessoa = nome(a.employee_id); const futuro = new Date(a.starts_at).getTime() > agora; return <tr key={a.id}>
            <td><span className="primary-cell">{pessoa?.name ?? "Funcionário"}</span>{a.note && <span className="secondary-cell">{a.note}</span>}</td>
            <td>{teamName(pessoa?.home_team_id ?? null)}</td>
            <td><strong>{teamName(a.team_id)}</strong></td>
            <td>{futuro ? `começa ${dia(a.starts_at)}` : dia(a.starts_at)}</td>
            <td>{dia(a.ends_at)}</td>
            <td><div className="tr-acoes">
              <Link className="button ghost" href={`/funcionarios/${a.employee_id}`}>Ficha</Link>
              {admin && <SiteOperationForm title="Encerrar apoio" label="Encerrar e voltar à equipe" command="end_assignment" fixed={{ assignment_id: a.id }} fields={[]} submit={submit} />}
            </div></td>
          </tr>; })}</tbody>
        </table></div>}
    </section>
    <details className="panel apoio-todos">
      <summary>Ver todos os funcionários e onde estão ({data.employees.length})</summary>
      <div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Funcionário</th><th>Equipe de origem</th><th>Trabalhando com</th><th>Ficha</th></tr></thead>
        <tbody>{data.employees.map((e) => <tr key={e.id}>
          <td><span className="primary-cell">{e.name}</span></td>
          <td>{teamName(e.home_team_id)}</td>
          <td>{e.team_id !== e.home_team_id ? <strong>{teamName(e.team_id)} (apoio)</strong> : teamName(e.team_id)}</td>
          <td><Link className="button ghost" href={`/funcionarios/${e.id}`}>Abrir</Link></td>
        </tr>)}</tbody>
      </table></div>
    </details>
    {admin && <SiteOperationForm title="Registrar funcionário ajudando outra equipe" command="assign_employee" submit={submit}
      fields={[
        { name: "employee_id", label: "Funcionário", type: "select", options: data.employees },
        { ...teamField, label: "Equipe em que vai ajudar", options: data.teams },
        { name: "ends_at", label: "Fim previsto (opcional)", type: "date", required: false },
        note,
      ]} />}
  </>;
}
