part of '../../app.dart';

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Equipes')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'team-create-fab',
        onPressed: () async {
          await showTeamDialog(context, widget.repo);
          reload();
        },
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
              for (final t in teams)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.groups_2_outlined),
                    title: Text(t.name),
                    subtitle:
                        t.description == null ? null : Text(t.description!),
                    trailing: PopupMenuButton<String>(
                      onSelected: (action) async {
                        if (action == 'edit') {
                          await showTeamDialog(context, widget.repo, team: t);
                          reload();
                        } else if (action == 'delete') {
                          final yes = await confirm(
                            context,
                            'Excluir equipe?',
                            'A equipe só poderá ser excluída se não tiver estoque, equipamentos ou usuários ativos.',
                          );
                          if (yes == true) {
                            try {
                              await widget.repo.deleteTeam(t.id);
                              reload();
                            } catch (e) {
                              if (context.mounted) showError(context, e);
                            }
                          }
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'edit', child: Text('Editar')),
                        PopupMenuItem(value: 'delete', child: Text('Excluir')),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
