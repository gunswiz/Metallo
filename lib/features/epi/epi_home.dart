part of '../../app.dart';

class _EpiHome extends StatelessWidget {
  const _EpiHome(
      {required this.repo,
      required this.adminRepository,
      required this.people,
      required this.teams,
      required this.onRefresh});
  final EpiRepository repo;
  final AdminRepository adminRepository;
  final Future<List<Map<String, dynamic>>> people;
  final List<Team> teams;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<List<Map<String, dynamic>>>>(
      future: Future.wait([people, repo.fetchEpiDeliveries()]),
      builder: (context, snap) {
        if (snap.hasError) return _ModuleError(onRetry: onRefresh);
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final active = snap.data![0].where((p) => p['active'] == true).toList();
        final deliveries = snap.data![1];
        final monthStart = DateTime(DateTime.now().year, DateTime.now().month);
        int totalForKind(String kind) => deliveries
            .where((d) =>
                d['current_status'] == 'active' &&
                (d['epi_items'] as Map?)?['item_kind'] == kind)
            .fold(0, (sum, d) => sum + ((d['quantity'] as num?)?.toInt() ?? 0));
        final replacements = deliveries.where((d) {
          final date = DateTime.tryParse(d['delivered_at']?.toString() ?? '');
          return d['delivery_reason'] == 'replacement' &&
              date != null &&
              !date.isBefore(monthStart);
        }).length;
        final fieldTeams = teams.where((t) => !t.isCentral).toList();
        return RefreshIndicator(
          onRefresh: () async => onRefresh(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              const Text('Olá, Administrador',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              const Text('Gestão de EPI e itens de trabalho',
                  style: TextStyle(color: Colors.white60)),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _epiCard,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF17324B)),
                ),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(children: [
                        Expanded(
                            child: Text('Resumo geral',
                                style: TextStyle(fontWeight: FontWeight.w800))),
                        Icon(Icons.verified_user_outlined, color: _epiBlue),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        Expanded(
                            child: _Metric(
                                icon: Icons.groups_2_outlined,
                                value: '${active.length}',
                                label: 'Funcionários')),
                        const SizedBox(width: 10),
                        Expanded(
                            child: _Metric(
                                icon: Icons.health_and_safety_outlined,
                                value: '${totalForKind('epi')}',
                                label: 'EPIs entregues')),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                            child: _Metric(
                                icon: Icons.work_outline,
                                value: '${totalForKind('personal_tool')}',
                                label: 'Itens pessoais')),
                        const SizedBox(width: 10),
                        Expanded(
                            child: _Metric(
                                icon: Icons.sync_rounded,
                                value: '$replacements',
                                label: 'Trocas no mês')),
                      ]),
                    ]),
              ),
              const SizedBox(height: 22),
              const Text('Equipes',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              const Text('A COSEM permanece como centro de todas as entregas.',
                  style: TextStyle(color: Colors.white60)),
              const SizedBox(height: 12),
              _TeamEpiCard(
                name: teams
                        .where((t) => t.isCentral)
                        .map((t) => t.name)
                        .firstOrNull ??
                    'COSEM',
                people: active.where((p) => p['team_id'] == null).length,
                central: true,
                onTap: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => _CosemPage(repo: repo))),
              ),
              for (final team in fieldTeams)
                _TeamEpiCard(
                  name: team.name,
                  people: active
                      .where((p) => p['team_id']?.toString() == team.id)
                      .length,
                  onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                          builder: (_) => _TeamPeoplePage(
                              repo: repo,
                              adminRepository: adminRepository,
                              team: team,
                              people: active
                                  .where((p) =>
                                      p['team_id']?.toString() == team.id)
                                  .toList()))),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
            color: const Color(0xFF142234),
            borderRadius: BorderRadius.circular(13)),
        child: Row(children: [
          Icon(icon, color: _epiBlue, size: 25),
          const SizedBox(width: 10),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(value,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900)),
                Text(label,
                    maxLines: 2,
                    style:
                        const TextStyle(color: Colors.white60, fontSize: 11)),
              ])),
        ]),
      );
}

class _TeamEpiCard extends StatelessWidget {
  const _TeamEpiCard(
      {required this.name,
      required this.people,
      this.central = false,
      this.onTap});
  final String name;
  final int people;
  final bool central;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Card(
        color: _epiCard,
        margin: const EdgeInsets.only(bottom: 10),
        child: ListTile(
          onTap: onTap,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          leading: CircleAvatar(
            backgroundColor: const Color(0xFF0C355C),
            child: Icon(
                central ? Icons.warehouse_outlined : Icons.groups_2_outlined,
                color: _epiBlue),
          ),
          title:
              Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text(central
              ? 'Centro de estoque e distribuição'
              : '$people funcionários • entregas e pendências'),
          trailing:
              const Icon(Icons.chevron_right_rounded, color: Colors.white38),
        ),
      );
}
