export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database";

export type UserRole = "admin" | "engineer" | "leader" | "collaborator";

export type SessionProfile = {
  id: string;
  fullName: string;
  role: UserRole;
  teamId: string | null;
  active: boolean;
  operationPermissions?: string[] | null;
  operationTeamIds?: string[] | null;
};

export type PageResult<T> = {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
};
