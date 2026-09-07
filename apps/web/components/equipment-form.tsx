"use client";

import { useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/submit-button";

type Team = { id: string; name: string };
type EquipmentDefaults = {
  itemId?: string;
  assetId?: string;
  code?: string;
  name?: string;
  assetCode?: string;
  serialNumber?: string | null;
  category?: string | null;
  description?: string | null;
  teamId?: string | null;
  status?: string;
  notes?: string | null;
  ownershipType?: string;
  rentalCompany?: string | null;
  rentalStartDate?: string | null;
  rentalEndDate?: string | null;
};

export function EquipmentForm({
  action,
  teams,
  mode,
  defaults = {},
}: {
  action: (formData: FormData) => Promise<void>;
  teams: Team[];
  mode: "create" | "edit";
  defaults?: EquipmentDefaults;
}) {
  const [ownershipType, setOwnershipType] = useState(defaults.ownershipType === "rented" ? "rented" : "owned");
  const rented = ownershipType === "rented";

  return (
    <form action={action} className="form-grid">
      {defaults.itemId && <input type="hidden" name="itemId" value={defaults.itemId} />}
      {defaults.assetId && <input type="hidden" name="assetId" value={defaults.assetId} />}
      <label>Código do tipo<input name="code" defaultValue={defaults.code} maxLength={40} placeholder="EQ-SOLDA-MIG" required /></label>
      <label>Nome do tipo<input name="name" defaultValue={defaults.name} maxLength={120} placeholder="Máquina de solda MIG" required /></label>
      <label>Patrimônio<input name="assetCode" defaultValue={defaults.assetCode} maxLength={80} required /></label>
      <label>Número de série<input name="serialNumber" defaultValue={defaults.serialNumber ?? ""} maxLength={120} /></label>
      {mode === "create" && <label>Categoria<input name="category" defaultValue={defaults.category ?? ""} maxLength={80} /></label>}
      <label>Equipe/local<select name="teamId" required defaultValue={defaults.teamId ?? ""}><option value="" disabled>Selecione</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label>Tipo de propriedade<select name="ownershipType" value={ownershipType} onChange={(event) => setOwnershipType(event.target.value)}><option value="owned">Próprio</option><option value="rented">Alugado</option></select></label>
      {mode === "edit" && <label>Status<select name="status" defaultValue={defaults.status ?? "available"}><option value="available">Disponível</option><option value="in_use">Em uso</option><option value="maintenance">Manutenção</option><option value="damaged">Danificado</option><option value="lost">Perdido</option><option value="retired">Baixado</option></select></label>}
      {rented && <>
        <label>Empresa/fornecedor<input name="rentalCompany" defaultValue={defaults.rentalCompany ?? ""} maxLength={160} required /></label>
        <label>Início da locação<input name="rentalStartDate" type="date" lang="pt-BR" defaultValue={defaults.rentalStartDate ?? ""} /></label>
        <label>Fim previsto<input name="rentalEndDate" type="date" lang="pt-BR" defaultValue={defaults.rentalEndDate ?? ""} /></label>
      </>}
      {mode === "create" && <label className="full">Descrição do tipo<textarea name="description" defaultValue={defaults.description ?? ""} maxLength={500} /></label>}
      <label className="full">Observação do patrimônio<textarea name="notes" defaultValue={defaults.notes ?? ""} maxLength={500} placeholder="Somente informações visíveis ao usuário" /></label>
      <div className="form-actions"><Link className="button ghost" href="/equipamentos">Cancelar</Link><SubmitButton pendingLabel="Salvando…">{mode === "create" ? "Cadastrar patrimônio" : "Salvar alterações"}</SubmitButton></div>
    </form>
  );
}
