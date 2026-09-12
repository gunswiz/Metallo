import 'package:flutter/material.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/user_access.dart';
import 'package:metallo/07_TIPOS_E_MODELOS/team.dart';

class UserPermissionsEditor extends StatelessWidget {
  const UserPermissionsEditor(
      {super.key,
      required this.role,
      required this.teams,
      required this.permissions,
      required this.teamIds,
      required this.onPermissionsChanged,
      required this.onTeamsChanged,
      this.enabled = true});
  final String role;
  final List<Team> teams;
  final List<String>? permissions;
  final List<String>? teamIds;
  final ValueChanged<List<String>?> onPermissionsChanged;
  final ValueChanged<List<String>?> onTeamsChanged;
  final bool enabled;
  List<String> _toggle(List<String> values, String id, bool selected) =>
      selected
          ? {...values, id}.toList()
          : values.where((v) => v != id).toList();
  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Divider(),
          const Text('Permissões de operação',
              style: TextStyle(fontWeight: FontWeight.bold)),
          const Text(
              'A ADM concede os direitos indicados pelo encarregado. Administradores mantêm acesso completo.'),
          SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Escolher permissões'),
              value: permissions != null,
              onChanged: enabled
                  ? (value) => onPermissionsChanged(
                      value ? defaultOperationPermissions(role) : null)
                  : null),
          if (permissions == null)
            const Text('Usar os direitos padrão do cargo.'),
          if (permissions != null)
            for (final entry in operationPermissionLabels.entries)
              CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(entry.value),
                  value: permissions!.contains(entry.key),
                  onChanged: enabled
                      ? (value) => onPermissionsChanged(
                          _toggle(permissions!, entry.key, value == true))
                      : null),
          SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Escolher equipes autorizadas'),
              value: teamIds != null,
              onChanged: enabled
                  ? (value) => onTeamsChanged(value ? [] : null)
                  : null),
          if (teamIds == null)
            const Text(
                'Encarregados e responsáveis operam na própria equipe. Engenheiros e ADM têm acesso geral.'),
          if (teamIds != null) ...[
            const Text(
                'Selecione todas as equipes autorizadas, incluindo a principal. Sem seleção, fica sem locais para operar.'),
            for (final team in teams)
              CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(team.name),
                  value: teamIds!.contains(team.id),
                  onChanged: enabled
                      ? (value) => onTeamsChanged(
                          _toggle(teamIds!, team.id, value == true))
                      : null),
          ],
        ],
      );
}
