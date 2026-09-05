import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/admin/dialogs.dart';

class UsersManagementPage extends StatefulWidget {
  const UsersManagementPage({super.key, required this.repo});
  final AdminRepository repo;

  @override
  State<UsersManagementPage> createState() => _UsersManagementPageState();
}

class _UsersManagementPageState extends State<UsersManagementPage> {
  late Future<List<Map<String, dynamic>>> users = widget.repo.fetchProfiles();
  void reload() => setState(() => users = widget.repo.fetchProfiles());

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.dashboardRepository.watchDashboard(),
      builder: (context, teamSnap) {
        if (!teamSnap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final teams = teamSnap.data!.teams;

        return Scaffold(
          appBar: AppBar(title: const Text('Usuários')),
          body: FutureBuilder<List<Map<String, dynamic>>>(
            future: users,
            builder: (context, snap) {
              if (snap.hasError) return ErrorState(error: snap.error);
              if (!snap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final user in snap.data!)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          user['active'] == true
                              ? Icons.verified_user_outlined
                              : Icons.hourglass_empty,
                        ),
                        title: Text(user['full_name']?.toString() ?? 'Usuário'),
                        subtitle: Text(
                          '${roleLabel(user['role']?.toString() ?? 'collaborator')} • '
                          '${(user['teams'] as Map?)?['name'] ?? 'Sem equipe'} • '
                          '${user['active'] == true ? 'Ativo' : 'Aguardando liberação'}',
                        ),
                        trailing: PopupMenuButton<String>(
                          onSelected: (action) async {
                            if (action == 'edit') {
                              await showUserEditDialog(
                                  context, widget.repo, teams, user);
                              reload();
                            } else if (action == 'delete') {
                              final yes = await confirm(
                                context,
                                'Excluir usuário?',
                                'O acesso será removido permanentemente. O histórico operacional já registrado será preservado.',
                              );
                              if (yes == true) {
                                try {
                                  await widget.repo
                                      .deleteEmployee(user['id'].toString());
                                  reload();
                                } catch (e) {
                                  if (context.mounted) showError(context, e);
                                }
                              }
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'edit', child: Text('Editar')),
                            PopupMenuItem(
                                value: 'delete', child: Text('Excluir')),
                          ],
                        ),
                        onTap: () async {
                          await showUserEditDialog(
                              context, widget.repo, teams, user);
                          reload();
                        },
                      ),
                    ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}
