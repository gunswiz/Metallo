import { canOperateTeam } from "@metallo/core";
import type { SessionProfile } from "@metallo/types";
import type { SiteSnapshot } from "@/03_FUNCOES_E_LOGICA/operacoesObra";
import type { OperationField } from "../formulario-obra";
export function siteFields(data: SiteSnapshot, profile: SessionProfile) {
  const teamName = (id: string | null) =>
    data.teams.find((x) => x.id === id)?.name ?? "Sem equipe";
  const workName = (id: string | null) =>
    data.works.find((x) => x.id === id)?.name ?? "COSEM / estoque central";
  const allowedTeams = data.teams.filter((t) => canOperateTeam(profile, t.id));
  const teamField: OperationField = {
    name: "team_id",
    label: "Equipe que está executando o serviço",
    type: "select",
    options: allowedTeams,
  };
  const note: OperationField = {
    name: "note",
    label: "Observação",
    type: "textarea",
    required: false,
  };
  const quantity: OperationField = {
    name: "quantity",
    label: "Quantidade",
    type: "number",
    value: "1",
    max: 100000,
  };

  return { teamName, workName, allowedTeams, teamField, note, quantity };
}
