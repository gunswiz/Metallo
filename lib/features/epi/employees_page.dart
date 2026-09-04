part of '../../app.dart';

class _TeamPeoplePage extends StatelessWidget {
  const _TeamPeoplePage(
      {required this.repo, required this.team, required this.people});
  final MetalloRepository repo;
  final Team team;
  final List<Map<String, dynamic>> people;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(team.name)),
        body: people.isEmpty
            ? const Center(child: Text('Nenhum funcionário nesta equipe.'))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: people.length,
                itemBuilder: (_, i) {
                  final p = people[i];
                  return Card(
                      color: _epiCard,
                      child: ListTile(
                        leading: const CircleAvatar(
                            backgroundColor: Color(0xFF0C355C),
                            child: Icon(Icons.person_outline, color: _epiBlue)),
                        title: Text(p['full_name']?.toString() ?? 'Funcionário',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text(p['profession']?.toString() ?? ''),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => _openEmployeeDetails(context, repo, p),
                      ));
                },
              ),
      );
}

class _EmployeesPage extends StatefulWidget {
  const _EmployeesPage(
      {required this.repo,
      required this.people,
      required this.teams,
      required this.role,
      required this.onRefresh});
  final MetalloRepository repo;
  final Future<List<Map<String, dynamic>>> people;
  final List<Team> teams;
  final String role;
  final VoidCallback onRefresh;
  @override
  State<_EmployeesPage> createState() => _EmployeesPageState();
}

class _EmployeesPageState extends State<_EmployeesPage> {
  String query = '';
  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: widget.people,
        builder: (context, snap) {
          if (snap.hasError) return _ModuleError(onRetry: widget.onRefresh);
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          final rows = snap.data!
              .where((p) =>
                  p['active'] == true &&
                  (p['full_name']
                          ?.toString()
                          .toLowerCase()
                          .contains(query.toLowerCase()) ??
                      false))
              .toList();
          return Column(children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                onChanged: (v) => setState(() => query = v),
                decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Pesquisar funcionário ou profissão'),
              ),
            ),
            if (widget.role == 'admin')
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: FilledButton.icon(
                  onPressed: () async {
                    if (await _employeeForm(
                            context, widget.repo, widget.teams) &&
                        mounted) widget.onRefresh();
                  },
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                  label: const Text('Cadastrar funcionário'),
                ),
              ),
            Expanded(
                child: rows.isEmpty
                    ? const Center(
                        child: Text('Nenhum funcionário encontrado.'))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: rows.length,
                        itemBuilder: (_, i) {
                          final person = rows[i];
                          final teamName =
                              (person['teams'] as Map?)?['name']?.toString() ??
                                  'Sem equipe';
                          return Card(
                            color: _epiCard,
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              leading: const CircleAvatar(
                                  backgroundColor: Color(0xFF0C355C),
                                  child: Icon(Icons.person_outline,
                                      color: _epiBlue)),
                              title: Text(
                                  person['full_name']?.toString() ??
                                      'Funcionário',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                              subtitle: Text(
                                  '${person['profession'] ?? 'Profissão não informada'} • $teamName\n${_asoLabel(person)}'),
                              trailing: const Icon(Icons.chevron_right_rounded),
                              onTap: () => _openEmployeeDetails(
                                  context, widget.repo, person),
                              onLongPress: widget.role == 'admin'
                                  ? () => _employeeActions(context, widget.repo,
                                      widget.teams, person, widget.onRefresh)
                                  : null,
                            ),
                          );
                        },
                      )),
          ]);
        },
      );
}
