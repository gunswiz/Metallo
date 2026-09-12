"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";
import type { UserRole } from "@metallo/types";
import { updateProfile } from "@/app/actions/operations";
import { SubmitButton } from "./submit-button";
import { UserPermissions } from "./permissoes-usuario";

type EditableProfile = {
  id: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
  active: boolean;
  operation_permissions?: string[] | null;
  operation_team_ids?: string[] | null;
};

export function EditUser({ profile, teams }: {
  profile: EditableProfile;
  teams: Array<{ id: string; name: string }>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [role, setRole] = useState(profile.role);
  const [revision, setRevision] = useState(0);

  // A refreshed profile means the server has finished handling the save.
  useEffect(() => {
    dialog.current?.close();
  }, [profile]);

  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button type="button" className="button ghost user-edit-trigger" aria-label={`Editar ${profile.full_name}`} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <Pencil size={15} aria-hidden="true" /> Editar
      </button>
      <dialog ref={dialog} className="user-edit-dialog" aria-labelledby={titleId} onClose={() => {
        setRole(profile.role);
        setRevision((value) => value + 1);
      }}>
        <header className="user-edit-header">
          <div>
            <h2 id={titleId}>Editar usuário</h2>
            <p>{profile.full_name}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Fechar edição" onClick={close}><X size={20} aria-hidden="true" /></button>
        </header>
        <form key={revision} action={updateProfile} className="user-edit-form">
          <input name="userId" type="hidden" value={profile.id} />
          <div className="user-edit-body form-grid">
            <label className="full">Nome completo<input name="fullName" defaultValue={profile.full_name} required /></label>
            <label>Papel<select name="role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="admin">Administrador</option>
              <option value="engineer">Engenheiro</option>
              <option value="leader">Líder</option>
              <option value="collaborator">Colaborador</option>
            </select></label>
            <label>Equipe<select name="teamId" defaultValue={profile.team_id ?? ""}>
              <option value="">Acesso geral</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></label>
            <label className="full checkbox-label user-status-toggle">
              <input name="active" type="checkbox" defaultChecked={profile.active} />
              <span>Perfil ativo<small>Permitir que esta pessoa acesse o Metallo.</small></span>
            </label>
            <UserPermissions teams={teams} role={role} permissions={profile.operation_permissions} teamIds={profile.operation_team_ids} />
          </div>
          <footer className="user-edit-footer">
            <button type="button" className="button ghost" onClick={close}>Cancelar</button>
            <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
          </footer>
        </form>
      </dialog>
    </>
  );
}
