import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/shared/widgets/async_action_dialog.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';

Future<void> showUserEditDialog(
  BuildContext context,
  AdminRepository repo,
  List<Team> teams,
  Map<String, dynamic> user,
) async {
  final actionLock = UiActionLock.acquire(context, 'showUserEditDialog');
  if (actionLock == null) return;
  try {
    final name =
        TextEditingController(text: user['full_name']?.toString() ?? '');
    try {
      String role = user['role']?.toString() ?? 'collaborator';
      String? teamId = user['team_id']?.toString();
      bool active = user['active'] == true;
      bool busy = false;
      String? error;

      await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Editar usuário'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Nome')),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: role,
                    decoration: const InputDecoration(labelText: 'Cargo'),
                    items: const [
                      DropdownMenuItem(value: 'admin', child: Text('Admin')),
                      DropdownMenuItem(
                          value: 'engineer', child: Text('Engenheiro')),
                      DropdownMenuItem(
                          value: 'leader', child: Text('Encarregado')),
                      DropdownMenuItem(
                          value: 'collaborator', child: Text('Colaborador')),
                    ],
                    onChanged: busy ? null : (v) => setLocal(() => role = v!),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: teamId,
                    decoration: const InputDecoration(labelText: 'Equipe'),
                    items: teams
                        .map((t) =>
                            DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged: busy ? null : (v) => setLocal(() => teamId = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Acesso liberado'),
                    value: active,
                    onChanged: busy ? null : (v) => setLocal(() => active = v),
                  ),
                  if (error != null)
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        if (role != 'admin' && teamId == null) {
                          setLocal(() => error = 'Selecione uma equipe.');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.updateProfileAdmin(
                            userId: user['id'].toString(),
                            fullName: name.text,
                            role: role,
                            teamId: role == 'admin' ? teamId : teamId,
                            active: active,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          setLocal(() => error = friendlyError(e));
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                child: const Text('Salvar'),
              ),
            ],
          ),
        ),
      );
    } finally {
      name.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showTeamDialog(
  BuildContext context,
  AdminRepository repo, {
  Team? team,
}) async {
  final actionLock = UiActionLock.acquire(context, 'showTeamDialog');
  if (actionLock == null) return;
  try {
    final name = TextEditingController(text: team?.name ?? '');
    final desc = TextEditingController(text: team?.description ?? '');
    try {
      await showAsyncActionDialog(
        context: context,
        title: Text(team == null ? 'Nova equipe' : 'Editar equipe'),
        content: [
          TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nome')),
          const SizedBox(height: 10),
          TextField(
            controller: desc,
            decoration:
                const InputDecoration(labelText: 'Descrição (opcional)'),
          ),
        ],
        actionLabel: team == null ? 'Criar' : 'Salvar',
        validate: () => name.text.trim().isEmpty ? 'Informe o nome.' : null,
        onAction: () async {
          if (team == null) {
            await repo.createTeam(name.text, desc.text);
          } else {
            await repo.updateTeam(team.id, name.text, desc.text);
          }
        },
        errorText: friendlyError,
      );
    } finally {
      name.dispose();
      desc.dispose();
    }
  } finally {
    actionLock.release();
  }
}
