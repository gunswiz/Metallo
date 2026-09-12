const operationPermissionLabels = <String, String>{
  'materials:write': 'Registrar entradas e movimentar materiais',
  'consumption:write': 'Registrar consumo',
  'equipment:write': 'Cadastrar e movimentar equipamentos',
  'epi:write': 'Registrar entregas, solicitações e baixas de EPI',
  'requests:write': 'Solicitar compras e confirmar recebimentos',
  'rentals:write': 'Solicitar máquinas e avisar sobre devoluções',
};

List<String> defaultOperationPermissions(String role) {
  if (role == 'admin' || role == 'engineer') {
    return operationPermissionLabels.keys.toList();
  }
  if (role == 'leader') {
    return operationPermissionLabels.keys
        .where((p) => p != 'epi:write')
        .toList();
  }
  return [];
}

class UserAccess {
  const UserAccess(
      {this.role = 'collaborator',
      this.active = false,
      this.teamId,
      this.permissions,
      this.teamIds});
  factory UserAccess.fromProfile(Map<String, dynamic>? profile) => UserAccess(
        role: profile?['role']?.toString() ?? 'collaborator',
        active: profile?['active'] == true,
        teamId: profile?['team_id']?.toString(),
        permissions:
            (profile?['operation_permissions'] as List?)?.cast<String>(),
        teamIds: (profile?['operation_team_ids'] as List?)?.cast<String>(),
      );
  final String role;
  final bool active;
  final String? teamId;
  final List<String>? permissions;
  final List<String>? teamIds;
  bool can(String permission) =>
      active &&
      (role == 'admin' ||
          (permissions ?? defaultOperationPermissions(role))
              .contains(permission));
  bool allowsTeam(String? id) =>
      active &&
      id != null &&
      (role == 'admin' ||
          (teamIds != null
              ? teamIds!.contains(id)
              : role == 'engineer' || teamId == id));
  bool canAt(String permission, String? id) =>
      can(permission) && allowsTeam(id);
}
