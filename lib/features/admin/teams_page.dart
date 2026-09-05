import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/admin/dialogs.dart';

class TeamsPage extends StatefulWidget {
  const TeamsPage({super.key, required this.repo});
  final AdminRepository repo;

  @override
  State<TeamsPage> createState() => _TeamsPageState();
}

class _TeamsPageState extends State<TeamsPage> {
  late Future<DashboardSnapshot> future =
      widget.repo.dashboardRepository.fetchDashboard();

  void reload() =>
      setState(() => future = widget.repo.dashboardRepository.fetchDashboard());

  Future<void> _createTeam() async {
    await showTeamDialog(context, widget.repo);
    reload();
  }

  Future<void> _handleTeamAction(String action, Team team) async {
    if (action == 'edit') {
      await showTeamDialog(context, widget.repo, team: team);
      reload();
      return;
    }
    if (action != 'delete') return;
    final confirmed = await confirm(
      context,
      'Excluir equipe?',
      'A equipe só poderá ser excluída se não tiver estoque, equipamentos ou usuários ativos.',
    );
    if (confirmed != true) return;
    try {
      await widget.repo.deleteTeam(team.id);
      reload();
    } catch (error) {
      if (mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Equipes')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'team-create-fab',
        onPressed: _createTeam,
        icon: const Icon(Icons.add),
        label: const Text('Criar equipe'),
      ),
      body: FutureBuilder<DashboardSnapshot>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorState(error: snap.error);
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final teams = snap.data!.teams;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${teams.where((t) => !t.isCentral).length} equipes de campo • COSEM separada',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              for (final team in teams)
                _TeamCard(
                  team: team,
                  onAction: (action) => _handleTeamAction(action, team),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _TeamCard extends StatelessWidget {
  const _TeamCard({required this.team, required this.onAction});

  final Team team;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: const Icon(Icons.groups_2_outlined),
          title: Text(team.name),
          subtitle: team.description == null ? null : Text(team.description!),
          trailing: PopupMenuButton<String>(
            onSelected: onAction,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Editar')),
              PopupMenuItem(value: 'delete', child: Text('Excluir')),
            ],
          ),
        ),
      );
}
