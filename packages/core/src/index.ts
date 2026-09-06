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

const movementLabels: Record<string, string> = {
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
  return movementLabels[value] ?? value.replaceAll("_", " ");
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
