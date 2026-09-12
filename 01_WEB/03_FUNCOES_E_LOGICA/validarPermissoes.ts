import { z } from "zod";
import { operationPermissions } from "@metallo/core";

export const userPermissionsSchema = z.object({
  operationPermissions: z.array(z.enum(operationPermissions)).max(6).nullable(),
  operationTeamIds: z.array(z.uuid()).max(100).nullable(),
});
export function parseUserPermissions(formData: FormData) {
  return userPermissionsSchema.safeParse({
    operationPermissions: formData.get("customPermissions") === "on" ? [...new Set(formData.getAll("operationPermissions"))] : null,
    operationTeamIds: formData.get("customTeams") === "on" ? [...new Set(formData.getAll("operationTeamIds"))] : null,
  });
}
