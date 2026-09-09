import type { UserRole } from "@metallo/types";

export type Capability =
  | "dashboard:read"
  | "inventory:read"
  | "operations:write"
  | "epi:read"
  | "epi:write"
  | "admin:manage";

const grants: Record<UserRole, ReadonlySet<Capability>> = {
  admin: new Set([
    "dashboard:read",
    "inventory:read",
    "operations:write",
    "epi:read",
    "epi:write",
    "admin:manage",
  ]),
  engineer: new Set([
    "dashboard:read",
    "inventory:read",
    "operations:write",
    "epi:read",
    "epi:write",
  ]),
  leader: new Set(["dashboard:read", "inventory:read", "operations:write"]),
  collaborator: new Set(["dashboard:read", "inventory:read"]),
};

export function can(role: UserRole, capability: Capability): boolean {
  return grants[role].has(capability);
}

export function isUserRole(value: unknown): value is UserRole {
  return (
    value === "admin" ||
    value === "engineer" ||
    value === "leader" ||
    value === "collaborator"
  );
}

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  engineer: "Engenheiro",
  leader: "Líder",
  collaborator: "Colaborador",
};

export const movementLabels: Readonly<Record<string, string>> = {
  entry: "Entrada",
  exit: "Saída",
  transfer: "Transferência",
  consumption: "Consumo",
  replenishment: "Reposição",
  adjustment: "Ajuste",
  assign: "Atribuição",
  maintenance: "Manutenção",
  return: "Devolução",
  rental_return: "Devolução de aluguel",
  rental_replacement: "Substituição de aluguel",
  status_change: "Alteração de status",
};

export function movementLabel(value: string): string {
  return movementLabels[value] ?? "Operação não identificada";
}

export const statusLabels: Readonly<Record<string, string>> = {
  active: "Ativo",
  available: "Disponível",
  in_use: "Em uso",
  pending: "Pendente",
  fulfilled: "Atendida",
  cancelled: "Cancelada",
  maintenance: "Manutenção",
  damaged: "Danificado",
  lost: "Perdido",
  retired: "Baixado",
  returned: "Devolvido",
  replaced: "Substituído",
  consumed: "Consumido",
};

export function statusLabel(value: string): string {
  return statusLabels[value] ?? "Situação não identificada";
}

export const itemKindLabels: Readonly<Record<string, string>> = {
  epi: "EPI",
  uniform: "Fardamento",
  personal_tool: "Item pessoal",
};

export function itemKindLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return itemKindLabels[value] ?? "Tipo não identificado";
}

export const returnPolicyLabels: Readonly<Record<string, string>> = {
  returnable: "Devolução obrigatória",
  personal: "Uso pessoal",
  uniform: "Fardamento",
  consumable: "Consumível",
};

export function returnPolicyLabel(value: string | null | undefined): string {
  if (!value) return "Não informada";
  return returnPolicyLabels[value] ?? "Política não identificada";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

export function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, 80);
}
