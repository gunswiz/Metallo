import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/team.dart';
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

  Future<void> _editUser(
    BuildContext context,
    List<Team> teams,
    Map<String, dynamic> user,
  ) async {
    await showUserEditDialog(context, widget.repo, teams, user);
    reload();
  }

  Future<void> _handleUserAction(
    BuildContext context,
    String action,
    List<Team> teams,
    Map<String, dynamic> user,
  ) async {
    if (action == 'edit') {
      await _editUser(context, teams, user);
      return;
    }
    if (action != 'delete') return;
    final confirmed = await confirm(
      context,
      'Excluir usuário?',
      'O acesso será removido permanentemente. O histórico operacional já registrado será preservado.',
    );
    if (confirmed != true) return;
    try {
      await widget.repo.deleteEmployee(user['id'].toString());
      reload();
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

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
                    _UserCard(
                      user: user,
                      onTap: () => _editUser(context, teams, user),
                      onAction: (action) =>
                          _handleUserAction(context, action, teams, user),
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

class _UserCard extends StatelessWidget {
  const _UserCard({
    required this.user,
    required this.onTap,
    required this.onAction,
  });

  final Map<String, dynamic> user;
  final VoidCallback onTap;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final active = user['active'] == true;
    return Card(
      child: ListTile(
        leading: Icon(
          active ? Icons.verified_user_outlined : Icons.hourglass_empty,
        ),
        title: Text(user['full_name']?.toString() ?? 'Usuário'),
        subtitle: Text(
          '${roleLabel(user['role']?.toString() ?? 'collaborator')} • '
          '${(user['teams'] as Map?)?['name'] ?? 'Sem equipe'} • '
          '${active ? 'Ativo' : 'Aguardando liberação'}',
        ),
        trailing: PopupMenuButton<String>(
          onSelected: onAction,
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'edit', child: Text('Editar')),
            PopupMenuItem(value: 'delete', child: Text('Excluir')),
          ],
        ),
        onTap: onTap,
      ),
    );
  }
}
