const allowed = new Set(['materials:write', 'consumption:write', 'equipment:write', 'epi:write', 'requests:write', 'rentals:write']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateAccess(body: Record<string, unknown>) {
  const permissions = body.operation_permissions ?? null;
  const teams = body.operation_team_ids ?? null;
  if (permissions !== null && (!Array.isArray(permissions) || permissions.length > 6 || permissions.some((p) => typeof p !== 'string' || !allowed.has(p)))) {
    throw new Error('invalid_permissions');
  }
  if (teams !== null && (!Array.isArray(teams) || teams.length > 100 || teams.some((id) => typeof id !== 'string' || !uuid.test(id)))) {
    throw new Error('invalid_permissions');
  }
  return {
    operation_permissions: permissions === null ? null : [...new Set(permissions as string[])],
    operation_team_ids: teams === null ? null : [...new Set(teams as string[])],
  };
}
