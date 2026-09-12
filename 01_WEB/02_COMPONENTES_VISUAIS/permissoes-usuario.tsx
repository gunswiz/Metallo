"use client";

import { useState } from "react";
import {
  defaultPermissions,
  operationPermissions,
  permissionLabels,
} from "@metallo/core";
import type { UserRole } from "@metallo/types";

export function UserPermissions({
  role = "collaborator",
  permissions = null,
  teamIds = null,
  teams,
}: {
  role?: UserRole;
  permissions?: string[] | null;
  teamIds?: string[] | null;
  teams: Array<{ id: string; name: string }>;
}) {
  const [custom, setCustom] = useState(permissions !== null);
  const [scoped, setScoped] = useState(teamIds !== null);
  return (
    <fieldset className="full permission-fields">
      <legend>Permissões de operação</legend>
      <p className="muted">
        Defina o que esta pessoa pode fazer e quais equipes pode atender.
        Administradores mantêm acesso completo.
      </p>
      <div className="permission-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="customPermissions"
            checked={custom}
            onChange={(event) => setCustom(event.target.checked)}
          />
          Escolher permissões para este usuário
        </label>
        {custom ? (
          <div className="permission-options">
            {operationPermissions.map((key) => (
              <label className="checkbox-label" key={key}>
                <input
                  type="checkbox"
                  name="operationPermissions"
                  value={key}
                  defaultChecked={(
                    permissions ?? defaultPermissions(role)
                  ).includes(key)}
                />
                {permissionLabels[key]}
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">Usar os direitos padrão do cargo selecionado.</p>
        )}
      </div>
      <div className="permission-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="customTeams"
            checked={scoped}
            onChange={(event) => setScoped(event.target.checked)}
          />
          Escolher equipes em que pode operar
        </label>
        {scoped ? (
          <div className="permission-options">
            {teams.map((team) => (
              <label className="checkbox-label" key={team.id}>
                <input
                  type="checkbox"
                  name="operationTeamIds"
                  value={team.id}
                  defaultChecked={teamIds?.includes(team.id)}
                />
                {team.name}
              </label>
            ))}
          </div>
        ) : (
          <p className="muted">
            Encarregados e responsáveis operam na própria equipe; engenheiros e
            ADM têm acesso geral. Marque acima para conceder acesso a outras
            equipes.
          </p>
        )}
        {scoped && (
          <p className="muted">
            Selecione todas as equipes autorizadas, incluindo a equipe principal.
            Sem seleção, o usuário fica sem locais para operar.
          </p>
        )}
      </div>
    </fieldset>
  );
}
