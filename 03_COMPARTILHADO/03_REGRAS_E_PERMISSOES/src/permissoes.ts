import type { UserRole } from "@metallo/types";

export const operationPermissions = ["materials:write", "consumption:write", "equipment:write", "epi:write", "requests:write", "rentals:write"] as const;
export type OperationPermission = typeof operationPermissions[number];
export const permissionLabels: Record<OperationPermission, string> = {
  "materials:write": "Registrar entradas e movimentar materiais",
  "consumption:write": "Registrar consumo",
  "equipment:write": "Cadastrar e movimentar equipamentos",
  "epi:write": "Registrar entregas, solicitações e baixas de EPI",
  "requests:write": "Solicitar compras e confirmar recebimentos",
  "rentals:write": "Solicitar máquinas e avisar sobre devoluções",
};
export type AccessProfile = {
  role: UserRole;
  active?: boolean;
  teamId?: string | null;
  operationPermissions?: readonly string[] | null;
  operationTeamIds?: readonly string[] | null;
};
export function defaultPermissions(role: UserRole): OperationPermission[] {
  if (role === "admin" || role === "engineer") return [...operationPermissions];
  if (role === "leader") return operationPermissions.filter((key) => key !== "epi:write");
  return [];
}
export function hasOperationPermission(profile: AccessProfile, permission: OperationPermission): boolean {
  if (profile.active === false) return false;
  if (profile.role === "admin") return true;
  return (profile.operationPermissions ?? defaultPermissions(profile.role)).includes(permission);
}
export function canOperateTeam(profile: AccessProfile, teamId: string | null): boolean {
  if (profile.active === false || !teamId) return false;
  if (profile.role === "admin") return true;
  if (profile.operationTeamIds != null) return profile.operationTeamIds.includes(teamId);
  return profile.role === "engineer" || profile.teamId === teamId;
}
