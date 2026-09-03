import 'package:flutter/material.dart';

import 'repository.dart';

const _epiBlue = Color(0xFF168CFF);
const _epiCard = Color(0xFF101A27);
const _epiBackground = Color(0xFF03101B);

class EpiManagementShell extends StatefulWidget {
  const EpiManagementShell({
    super.key,
    required this.repo,
    required this.teams,
    required this.role,
  });

  final MetalloRepository repo;
  final List<Team> teams;
  final String role;

  @override
  State<EpiManagementShell> createState() => _EpiManagementShellState();
}

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

class _EpiManagementShellState extends State<EpiManagementShell> {
  int _page = 0;
  late Future<List<Map<String, dynamic>>> _people =
      widget.repo.fetchEpiEmployees();

  void _refresh() {
    setState(() {
      _people = widget.repo.fetchEpiEmployees();
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      _EpiHome(
          repo: widget.repo,
          people: _people,
          teams: widget.teams,
          onRefresh: _refresh),
      _EmployeesPage(
          repo: widget.repo,
          people: _people,
          teams: widget.teams,
          role: widget.role,
          onRefresh: _refresh),
      _ItemsPage(repo: widget.repo, role: widget.role),
      _ReportsPage(repo: widget.repo),
    ];
    return Theme(
      data: Theme.of(context).copyWith(scaffoldBackgroundColor: _epiBackground),
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: _epiBackground,
          titleSpacing: 4,
          title: Row(children: [
            Image.asset('assets/metallo_logo_outline.png',
                height: 34, width: 42),
            const SizedBox(width: 8),
            const Text('METALLO',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2)),
          ]),
          actions: [
            IconButton(
                tooltip: 'Atualizar',
                onPressed: _refresh,
                icon: const Icon(Icons.refresh)),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.notifications_none_rounded),
            ),
          ],
        ),
        body: IndexedStack(index: _page, children: pages),
        bottomNavigationBar: NavigationBar(
          height: 72,
          selectedIndex: _page > 1 ? _page + 1 : _page,
          onDestinationSelected: (value) {
            if (value == 2) {
              _showDeliveryStart(context, widget.repo, _refresh);
            } else {
              setState(() => _page = value > 2 ? value - 1 : value);
            }
          },
          destinations: const [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Início'),
            NavigationDestination(
                icon: Icon(Icons.groups_2_outlined), label: 'Funcionários'),
            NavigationDestination(
                icon: Icon(Icons.add_circle, size: 42, color: _epiBlue),
                label: 'Entrega'),
            NavigationDestination(
                icon: Icon(Icons.inventory_2_outlined), label: 'Itens'),
            NavigationDestination(
                icon: Icon(Icons.assessment_outlined), label: 'Relatórios'),
          ],
        ),
      ),
    );
  }
}

class _EpiHome extends StatelessWidget {
  const _EpiHome(
      {required this.repo,
      required this.people,
      required this.teams,
      required this.onRefresh});
  final MetalloRepository repo;
  final Future<List<Map<String, dynamic>>> people;
  final List<Team> teams;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<List<Map<String, dynamic>>>>(
      future: Future.wait([people, repo.fetchEpiDeliveries()]),
      builder: (context, snap) {
        if (snap.hasError) return _ModuleError(onRetry: onRefresh);
        if (!snap.hasData)
          return const Center(child: CircularProgressIndicator());
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

class _CosemPage extends StatefulWidget {
  const _CosemPage({required this.repo});
  final MetalloRepository repo;
  @override
  State<_CosemPage> createState() => _CosemPageState();
}

class _CosemPageState extends State<_CosemPage> {
  String query = '';
  String kind = 'all';
  late Future<List<List<Map<String, dynamic>>>> future = _load();

  Future<List<List<Map<String, dynamic>>>> _load() => Future.wait([
        widget.repo.fetchEpiStock(),
        widget.repo.fetchEpiRequests(),
      ]);

  void reload() => setState(() => future = _load());

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Estoque da COSEM'),
            actions: [
              IconButton(onPressed: reload, icon: const Icon(Icons.refresh))
            ],
            bottom: const TabBar(tabs: [
              Tab(text: 'Estoque'),
              Tab(text: 'Pendências'),
            ]),
          ),
          body: FutureBuilder<List<List<Map<String, dynamic>>>>(
            future: future,
            builder: (context, snap) {
              if (snap.hasError) return _ModuleError(onRetry: reload);
              if (!snap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return TabBarView(children: [
                _stockTab(snap.data![0]),
                _pendingTab(snap.data![1], snap.data![0]),
              ]);
            },
          ),
        ),
      );

  Widget _stockTab(List<Map<String, dynamic>> batches) {
    final totals = <String, Map<String, dynamic>>{};
    for (final batch in batches) {
      final item = Map<String, dynamic>.from(batch['epi_items'] as Map);
      final id = batch['item_id'].toString();
      final row = totals.putIfAbsent(
          id, () => {...item, 'quantity': 0, 'variants': <String, int>{}});
      row['quantity'] = (row['quantity'] as int) +
          ((batch['quantity'] as num?)?.toInt() ?? 0);
      final variant = batch['variant']?.toString().trim();
      if (variant != null && variant.isNotEmpty) {
        final variants = row['variants'] as Map<String, int>;
        variants[variant] = (variants[variant] ?? 0) +
            ((batch['quantity'] as num?)?.toInt() ?? 0);
      }
    }
    final items = totals.values.where((item) {
      final text = '${item['name']} ${item['code']} ${item['ca_number'] ?? ''}'
          .toLowerCase();
      return (kind == 'all' || item['item_kind'] == kind) &&
          text.contains(query.trim().toLowerCase());
    }).toList()
      ..sort((a, b) => a['name'].toString().compareTo(b['name'].toString()));
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(
        onChanged: (value) => setState(() => query = value),
        decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Pesquisar item no estoque'),
      ),
      const SizedBox(height: 10),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'all', label: Text('Todos')),
            ButtonSegment(value: 'epi', label: Text('EPIs')),
            ButtonSegment(value: 'personal_tool', label: Text('Pessoais')),
            ButtonSegment(value: 'uniform', label: Text('Fardas')),
          ],
          selected: {kind},
          onSelectionChanged: (value) => setState(() => kind = value.first),
        ),
      ),
      const SizedBox(height: 12),
      for (final item in items)
        Card(
          color: _epiCard,
          child: ListTile(
            onLongPress: (item['variants'] as Map).isEmpty
                ? null
                : () => _showVariantStock(item),
            leading:
                Icon(_kindIcon(item['item_kind']?.toString()), color: _epiBlue),
            title: Text(item['name']?.toString() ?? 'Item',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text((item['variants'] as Map).isEmpty
                ? '${_kindLabel(item['item_kind']?.toString())} • ${item['code']}'
                : '${_kindLabel(item['item_kind']?.toString())} • ${item['code']}\nPressione para ver cada variação'),
            isThreeLine: (item['variants'] as Map).isNotEmpty,
            trailing: Text('${item['quantity']} ${item['unit'] ?? 'un'}',
                style: const TextStyle(
                    color: _epiBlue,
                    fontSize: 16,
                    fontWeight: FontWeight.w900)),
          ),
        ),
      if (items.isEmpty)
        const Padding(
            padding: EdgeInsets.all(30),
            child: Center(child: Text('Nenhum item encontrado.'))),
    ]);
  }

  Future<void> _showVariantStock(Map<String, dynamic> item) async {
    final variants = Map<String, int>.from(item['variants'] as Map);
    final rows = variants.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(item['name']?.toString() ?? 'Estoque por variação',
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('${item['quantity']} ${item['unit'] ?? 'un'} no total',
                style: const TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            for (final row in rows)
              ListTile(
                leading: const CircleAvatar(
                    backgroundColor: Color(0xFF0C355C),
                    child: Icon(Icons.inventory_2_outlined, color: _epiBlue)),
                title: Text(
                    item['code'] == 'EPI-BOT' ? 'Número ${row.key}' : row.key),
                trailing: Text('${row.value} ${item['unit'] ?? 'un'}',
                    style: const TextStyle(
                        color: _epiBlue,
                        fontSize: 17,
                        fontWeight: FontWeight.w900)),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _pendingTab(
      List<Map<String, dynamic>> requests, List<Map<String, dynamic>> batches) {
    final pending = requests.where((r) => r['status'] == 'pending').toList();
    if (pending.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: _epiBlue.withValues(alpha: .12),
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.task_alt_rounded, color: _epiBlue, size: 36),
            ),
            const SizedBox(height: 18),
            const Text('Nenhuma pendência aberta',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text(
              'As solicitações feitas nos funcionários aparecerão aqui para atendimento.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white60, height: 1.35),
            ),
          ]),
        ),
      );
    }
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Solicitações aguardando atendimento',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
      const SizedBox(height: 4),
      const Text('Toque em Atender para entregar diretamente da COSEM.',
          style: TextStyle(color: Colors.white60)),
      const SizedBox(height: 12),
      for (final request in pending)
        Card(
          color: _epiCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: _epiBlue.withValues(alpha: .28)),
          ),
          child: ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _epiBlue.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(Icons.schedule_rounded, color: _epiBlue),
            ),
            title: Text(
                (request['epi_items'] as Map?)?['name']?.toString() ?? 'Item',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(
                '${(request['epi_employees'] as Map?)?['full_name'] ?? 'Funcionário'} • ${(request['teams'] as Map?)?['name'] ?? 'Equipe'}\n${request['quantity']} ${(request['epi_items'] as Map?)?['unit'] ?? 'un'}${request['requested_variant'] == null ? '' : ' • ${request['requested_variant']}'}'),
            isThreeLine: true,
            trailing: SizedBox(
              width: 76,
              height: 36,
              child: FilledButton(
                onPressed: () => _fulfill(request, batches),
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text('Atender',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ),
    ]);
  }

  Future<void> _fulfill(
      Map<String, dynamic> request, List<Map<String, dynamic>> batches) async {
    final available = batches
        .where((b) =>
            b['item_id'].toString() == request['item_id'].toString() &&
            (request['requested_variant'] == null ||
                b['variant']?.toString() ==
                    request['requested_variant']?.toString()) &&
            ((b['quantity'] as num?)?.toInt() ?? 0) >=
                ((request['quantity'] as num?)?.toInt() ?? 1))
        .toList();
    if (available.isEmpty) {
      _message(context, 'Não há estoque suficiente para esta pendência.');
      return;
    }
    final item = request['epi_items'] as Map?;
    final employee = request['epi_employees'] as Map?;
    final code = item?['code']?.toString();
    final shoeSize = employee?['shoe_size']?.toString();
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
          children: [
            Text('Escolha no estoque: ${item?['name'] ?? 'item'}',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            for (final batch in available)
              ListTile(
                leading:
                    const Icon(Icons.inventory_2_outlined, color: _epiBlue),
                title: Text(batch['variant'] == null
                    ? 'Sem variação'
                    : code == 'EPI-BOT'
                        ? 'Número ${batch['variant']}'
                        : batch['variant'].toString()),
                subtitle: Text(
                    '${batch['quantity']} ${item?['unit'] ?? 'un'} disponíveis${code == 'EPI-BOT' && batch['variant']?.toString() == shoeSize ? ' • número do funcionário' : ''}'),
                onTap: () => Navigator.pop(context, batch),
              ),
          ],
        ),
      ),
    );
    if (selected == null) return;
    try {
      await widget.repo.fulfillEpiRequest(
          request['id'].toString(), selected['id'].toString());
      if (!mounted) return;
      reload();
      _message(context, 'Pendência atendida e entregue ao funcionário.');
    } catch (_) {
      if (mounted) {
        _message(context,
            'Estoque insuficiente ou pendência já atendida. Confira o estoque.');
      }
    }
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
                                  '${person['profession'] ?? 'Profissão não informada'} • $teamName'),
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

class _ItemsPage extends StatefulWidget {
  const _ItemsPage({required this.repo, required this.role});
  final MetalloRepository repo;
  final String role;
  @override
  State<_ItemsPage> createState() => _ItemsPageState();
}

class _ItemsPageState extends State<_ItemsPage> {
  late Future<List<Map<String, dynamic>>> future = widget.repo.fetchEpiItems();
  String query = '';
  String kind = 'all';
  void reload() => setState(() => future = widget.repo.fetchEpiItems());
  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return _ModuleError(onRetry: reload);
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          final normalizedQuery = query.trim().toLowerCase();
          final items = snap.data!.where((item) {
            final matchesKind = kind == 'all' || item['item_kind'] == kind;
            final searchable = [
              item['name'],
              item['code'],
              item['ca_number'],
              item['brand_model']
            ].whereType<Object>().join(' ').toLowerCase();
            return matchesKind && searchable.contains(normalizedQuery);
          }).toList();
          return ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Itens da COSEM',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            const Text('Catálogos separados para não misturar controles.',
                style: TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            TextField(
              onChanged: (value) => setState(() => query = value),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Pesquisar por nome, código, CA ou marca',
              ),
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'all', label: Text('Todos')),
                  ButtonSegment(value: 'epi', label: Text('EPIs')),
                  ButtonSegment(
                      value: 'personal_tool', label: Text('Pessoais')),
                  ButtonSegment(value: 'uniform', label: Text('Fardas')),
                ],
                selected: {kind},
                onSelectionChanged: (value) =>
                    setState(() => kind = value.first),
              ),
            ),
            const SizedBox(height: 14),
            if (widget.role == 'admin')
              FilledButton.icon(
                  onPressed: () async {
                    final saved = await _itemForm(context, widget.repo);
                    if (!mounted) return;
                    if (saved) {
                      reload();
                    }
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Cadastrar item')),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(30),
                      child: Text('Nenhum item encontrado.'))),
            for (final item in items)
              Card(
                color: _epiCard,
                child: ListTile(
                  leading: Icon(_kindIcon(item['item_kind']?.toString()),
                      color: _epiBlue),
                  title: Text(item['name']?.toString() ?? 'Item',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(
                      '${_kindLabel(item['item_kind']?.toString())} • ${item['code']}${item['ca_number'] == null ? '' : ' • CA ${item['ca_number']}'}'),
                  trailing: widget.role == 'admin'
                      ? IconButton(
                          tooltip: 'Registrar entrada',
                          icon: const Icon(Icons.add_box_outlined),
                          onPressed: () async {
                            final registered =
                                await _stockForm(context, widget.repo, item);
                            if (!mounted) return;
                            if (registered) {
                              ScaffoldMessenger.of(this.context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Entrada registrada na COSEM.')));
                            }
                          })
                      : null,
                  onLongPress: widget.role == 'admin'
                      ? () => _itemActions(context, widget.repo, item, reload)
                      : null,
                ),
              ),
          ]);
        },
      );
}

class _ReportsPage extends StatefulWidget {
  const _ReportsPage({required this.repo});
  final MetalloRepository repo;
  @override
  State<_ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<_ReportsPage> {
  late Future<List<Map<String, dynamic>>> future =
      widget.repo.fetchEpiDeliveries();

  void reload() => setState(() => future = widget.repo.fetchEpiDeliveries());

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return _ModuleError(onRetry: reload);
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          final groups = <String, List<Map<String, dynamic>>>{};
          for (final row in snap.data!) {
            final key =
                row['delivery_group_id']?.toString() ?? row['id'].toString();
            groups.putIfAbsent(key, () => []).add(row);
          }
          return ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Entregas e histórico',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            Text('${groups.length} entregas por funcionário e equipe',
                style: const TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            if (snap.data!.isEmpty)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(30),
                      child: Text('Nenhuma entrega registrada.'))),
            for (final rows in groups.values)
              Card(
                color: _epiCard,
                child: ListTile(
                  leading: const CircleAvatar(
                      backgroundColor: Color(0xFF0C355C),
                      child: Icon(Icons.assignment_turned_in_outlined,
                          color: _epiBlue)),
                  title: Text(
                      rows.length == 1
                          ? ((rows.first['epi_items'] as Map?)?['name']
                                  ?.toString() ??
                              'Item')
                          : 'Entrega completa • ${rows.length} itens',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(
                      '${(rows.first['epi_employees'] as Map?)?['full_name'] ?? 'Funcionário'} • ${(rows.first['teams'] as Map?)?['name'] ?? 'Equipe'}\n${rows.map((r) => (r['epi_items'] as Map?)?['name']).join(', ')}'),
                  isThreeLine: true,
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () =>
                      _deliveryGroupDetails(context, widget.repo, rows, reload),
                ),
              ),
          ]);
        },
      );
}

class _ModuleError extends StatelessWidget {
  const _ModuleError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.cloud_off_outlined, size: 46, color: Colors.white54),
        const SizedBox(height: 10),
        const Text('Não foi possível carregar os funcionários.'),
        TextButton(onPressed: onRetry, child: const Text('Tentar novamente')),
      ]));
}

Future<void> _showDeliveryStart(
    BuildContext context, MetalloRepository repo, VoidCallback onSaved) async {
  late List<Map<String, dynamic>> employees;
  late List<Map<String, dynamic>> stock;
  try {
    final values =
        await Future.wait([repo.fetchEpiEmployees(), repo.fetchEpiStock()]);
    employees = values[0];
    stock = values[1]
        .where((s) => ((s['quantity'] as num?)?.toInt() ?? 0) > 0)
        .toList();
  } catch (e) {
    if (context.mounted)
      _message(context, 'Não foi possível carregar a entrega.');
    return;
  }
  if (!context.mounted) return;
  String? employeeId = employees.firstOrNull?['id']?.toString();
  String category = 'all';
  String search = '';
  final selected = <String, int>{};
  String reason = 'initial';
  String? error;
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => SafeArea(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                    20, 0, 20, MediaQuery.viewInsetsOf(context).bottom + 24),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Nova entrega',
                          style: TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      const Text(
                          'Escolha o funcionário e monte uma entrega completa com um ou vários itens da COSEM.',
                          style: TextStyle(color: Colors.white70)),
                      const SizedBox(height: 14),
                      if (employees.isEmpty || stock.isEmpty)
                        Text(
                            employees.isEmpty
                                ? 'Cadastre um funcionário primeiro.'
                                : 'Registre uma entrada na COSEM primeiro.',
                            style: const TextStyle(color: Colors.orangeAccent)),
                      if (employees.isNotEmpty)
                        DropdownButtonFormField<String>(
                          initialValue: employeeId,
                          decoration:
                              const InputDecoration(labelText: 'Funcionário'),
                          items: employees
                              .map((e) => DropdownMenuItem(
                                  value: e['id'].toString(),
                                  child: Text(
                                      '${e['full_name']} • ${e['profession']}',
                                      overflow: TextOverflow.ellipsis)))
                              .toList(),
                          onChanged: (v) => setLocal(() => employeeId = v),
                        ),
                      const SizedBox(height: 10),
                      if (stock.isNotEmpty) ...[
                        TextField(
                          decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.search),
                              hintText: 'Buscar item disponível'),
                          onChanged: (value) =>
                              setLocal(() => search = value.toLowerCase()),
                        ),
                        const SizedBox(height: 10),
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(value: 'all', label: Text('Todos')),
                              ButtonSegment(value: 'epi', label: Text('EPIs')),
                              ButtonSegment(
                                  value: 'personal_tool',
                                  label: Text('Pessoais')),
                              ButtonSegment(
                                  value: 'uniform', label: Text('Fardas')),
                            ],
                            selected: {category},
                            onSelectionChanged: (value) =>
                                setLocal(() => category = value.first),
                          ),
                        ),
                        const SizedBox(height: 8),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 280),
                          child: ListView(
                            shrinkWrap: true,
                            children: [
                              for (final batch in stock.where((s) {
                                final item = s['epi_items'] as Map?;
                                final matchesCategory = category == 'all' ||
                                    item?['item_kind'] == category;
                                final label =
                                    '${item?['name']} ${item?['code']} ${s['variant'] ?? ''}'
                                        .toLowerCase();
                                return matchesCategory &&
                                    label.contains(search.trim());
                              }))
                                Builder(builder: (context) {
                                  final item = batch['epi_items'] as Map?;
                                  final id = batch['id'].toString();
                                  final available =
                                      (batch['quantity'] as num?)?.toInt() ?? 0;
                                  final amount = selected[id] ?? 0;
                                  final variant =
                                      batch['variant']?.toString().trim();
                                  final employee = employees
                                      .where((e) =>
                                          e['id']?.toString() == employeeId)
                                      .firstOrNull;
                                  final preferredBoot = item?['code'] ==
                                          'EPI-BOT' &&
                                      variant != null &&
                                      variant.isNotEmpty &&
                                      variant ==
                                          employee?['shoe_size']?.toString();
                                  return Card(
                                    color: _epiCard,
                                    child: ListTile(
                                      leading: Icon(
                                          _kindIcon(
                                              item?['item_kind']?.toString()),
                                          color: _epiBlue),
                                      title: Text(
                                          '${item?['name'] ?? 'Item'}${variant == null || variant.isEmpty ? '' : item?['code'] == 'EPI-BOT' ? ' • Nº $variant' : ' • $variant'}'),
                                      subtitle: Text(
                                          '${_kindLabel(item?['item_kind']?.toString())} • $available ${item?['unit'] ?? 'un'} disponíveis${preferredBoot ? '\nTamanho cadastrado do funcionário' : ''}'),
                                      isThreeLine: preferredBoot,
                                      trailing: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                                onPressed: amount > 0
                                                    ? () => setLocal(() {
                                                          if (amount == 1) {
                                                            selected.remove(id);
                                                          } else {
                                                            selected[id] =
                                                                amount - 1;
                                                          }
                                                        })
                                                    : null,
                                                icon: const Icon(Icons.remove)),
                                            Text('$amount',
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.w900)),
                                            IconButton(
                                                onPressed: amount < available
                                                    ? () => setLocal(() =>
                                                        selected[id] =
                                                            amount + 1)
                                                    : null,
                                                icon: const Icon(Icons.add)),
                                          ]),
                                    ),
                                  );
                                }),
                            ],
                          ),
                        ),
                        Text(
                            '${selected.values.fold<int>(0, (a, b) => a + b)} unidades selecionadas',
                            style: const TextStyle(color: _epiBlue)),
                      ],
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                          initialValue: reason,
                          decoration:
                              const InputDecoration(labelText: 'Motivo'),
                          items: const [
                            DropdownMenuItem(
                                value: 'initial',
                                child: Text('Primeira entrega')),
                            DropdownMenuItem(
                                value: 'replacement',
                                child: Text('Substituição')),
                            DropdownMenuItem(
                                value: 'additional',
                                child: Text('Entrega adicional')),
                          ],
                          onChanged: (v) =>
                              setLocal(() => reason = v ?? 'initial')),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text(error!,
                                style:
                                    const TextStyle(color: Colors.redAccent))),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: employeeId == null || selected.isEmpty
                            ? null
                            : () async {
                                try {
                                  final lines = selected.entries.map((entry) {
                                    final batch = stock.firstWhere(
                                        (s) => s['id'].toString() == entry.key);
                                    return <String, dynamic>{
                                      'stock_batch_id': entry.key,
                                      'item_id': batch['item_id'].toString(),
                                      'quantity': entry.value,
                                    };
                                  }).toList();
                                  await repo.registerEpiDeliveryBatch(
                                      employeeId: employeeId!,
                                      lines: lines,
                                      reason: reason);
                                  if (context.mounted) Navigator.pop(context);
                                  onSaved();
                                } catch (_) {
                                  setLocal(() => error =
                                      'Não foi possível registrar a entrega.');
                                }
                              },
                        icon: const Icon(Icons.check_circle_outline),
                        label: const Text('Confirmar entrega'),
                      ),
                    ]),
              ),
            )),
  );
}

IconData _kindIcon(String? kind) => switch (kind) {
      'uniform' => Icons.checkroom_outlined,
      'personal_tool' => Icons.handyman_outlined,
      _ => Icons.health_and_safety_outlined,
    };

String _kindLabel(String? kind) => switch (kind) {
      'uniform' => 'Fardamento',
      'personal_tool' => 'Item pessoal',
      _ => 'EPI',
    };

String _statusLabel(String? status) => switch (status) {
      'returned' => 'Devolvido',
      'replaced' => 'Substituído',
      'lost' => 'Perdido',
      'damaged' => 'Danificado',
      'consumed' => 'Consumido',
      _ => 'Em uso',
    };

void _message(BuildContext context, String text) {
  final isError = text.toLowerCase().contains('erro') ||
      text.toLowerCase().contains('não foi') ||
      text.toLowerCase().contains('já foi');
  final color = isError ? Colors.orangeAccent : _epiBlue;
  final messenger = ScaffoldMessenger.of(context);
  messenger.clearSnackBars();
  messenger.showSnackBar(SnackBar(
    behavior: SnackBarBehavior.floating,
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 18),
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    duration: const Duration(seconds: 3),
    elevation: 8,
    backgroundColor: const Color(0xFF142234),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: BorderSide(color: color.withValues(alpha: .5)),
    ),
    content: Row(children: [
      Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: color.withValues(alpha: .16),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Icon(
          isError ? Icons.info_outline_rounded : Icons.check_rounded,
          color: color,
          size: 22,
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(text,
            style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700)),
      ),
    ]),
  ));
}

Future<bool> _employeeForm(
    BuildContext context, MetalloRepository repo, List<Team> teams,
    {Map<String, dynamic>? existing}) async {
  final form = GlobalKey<FormState>();
  final name =
      TextEditingController(text: existing?['full_name']?.toString() ?? '');
  final profession = TextEditingController(
      text: existing?['profession']?.toString() ?? 'Soldador');
  final registration = TextEditingController(
      text: existing?['registration_code']?.toString() ?? '');
  final shirt =
      TextEditingController(text: existing?['shirt_size']?.toString() ?? 'M');
  final pants = TextEditingController();
  final shoe =
      TextEditingController(text: existing?['shoe_size']?.toString() ?? '');
  String? teamId = existing?['team_id']?.toString() ??
      teams.where((t) => !t.isCentral).firstOrNull?.id ??
      teams.firstOrNull?.id;
  bool busy = false;
  String? error;
  final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
                title: Text(existing == null
                    ? 'Novo funcionário'
                    : 'Editar funcionário'),
                content: Form(
                    key: form,
                    child: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      TextFormField(
                          controller: name,
                          decoration:
                              const InputDecoration(labelText: 'Nome completo'),
                          validator: (v) => (v?.trim().length ?? 0) < 3
                              ? 'Informe o nome.'
                              : null),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                          initialValue: profession.text,
                          decoration:
                              const InputDecoration(labelText: 'Função'),
                          items: const [
                            'Soldador',
                            'Ajudante',
                            'Montador',
                            'Pintor',
                            'Encarregado',
                            'Operador de Munck'
                          ]
                              .map((v) =>
                                  DropdownMenuItem(value: v, child: Text(v)))
                              .toList(),
                          onChanged: (v) => profession.text = v ?? 'Soldador'),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                          initialValue: teamId,
                          decoration:
                              const InputDecoration(labelText: 'Equipe'),
                          items: teams
                              .where((t) => !t.isCentral)
                              .map((t) => DropdownMenuItem(
                                  value: t.id, child: Text(t.name)))
                              .toList(),
                          onChanged: (v) => teamId = v,
                          validator: (v) =>
                              v == null ? 'Selecione a equipe.' : null),
                      const SizedBox(height: 10),
                      TextFormField(
                          controller: registration,
                          decoration: const InputDecoration(
                              labelText: 'Matrícula (opcional)')),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                            child: DropdownButtonFormField<String>(
                                initialValue: shirt.text,
                                decoration: const InputDecoration(
                                    labelText: 'Tamanho da farda'),
                                items: const ['M', 'G', 'GG', 'XG', 'XXG']
                                    .map((v) => DropdownMenuItem(
                                        value: v, child: Text(v)))
                                    .toList(),
                                onChanged: (v) => shirt.text = v ?? 'M')),
                        const SizedBox(width: 8),
                        Expanded(
                            child: TextFormField(
                                controller: shoe,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    labelText: 'Calçado')))
                      ]),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text(error!,
                                style:
                                    const TextStyle(color: Colors.redAccent))),
                    ]))),
                actions: [
                  TextButton(
                      onPressed: busy
                          ? null
                          : () => Navigator.pop(dialogContext, false),
                      child: const Text('Cancelar')),
                  FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (!(form.currentState?.validate() ?? false))
                                return;
                              setLocal(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                if (existing == null) {
                                  await repo.createEpiEmployee(
                                      fullName: name.text,
                                      profession: profession.text,
                                      teamId: teamId!,
                                      registrationCode: registration.text,
                                      shirtSize: shirt.text,
                                      pantsSize: shirt.text,
                                      shoeSize: shoe.text);
                                } else {
                                  await repo.updateEpiEmployee(
                                      id: existing['id'].toString(),
                                      fullName: name.text,
                                      profession: profession.text,
                                      teamId: teamId!,
                                      registrationCode: registration.text,
                                      shirtSize: shirt.text,
                                      pantsSize: shirt.text,
                                      shoeSize: shoe.text);
                                }
                                if (dialogContext.mounted)
                                  Navigator.pop(dialogContext, true);
                              } catch (_) {
                                setLocal(() {
                                  busy = false;
                                  error =
                                      'Não foi possível salvar. Confira matrícula e dados.';
                                });
                              }
                            },
                      child: Text(busy ? 'Salvando...' : 'Salvar')),
                ],
              )));
  await Future<void>.delayed(const Duration(milliseconds: 350));
  name.dispose();
  profession.dispose();
  registration.dispose();
  shirt.dispose();
  pants.dispose();
  shoe.dispose();
  return result ?? false;
}

Future<void> _employeeActions(
    BuildContext context,
    MetalloRepository repo,
    List<Team> teams,
    Map<String, dynamic> person,
    VoidCallback onChanged) async {
  final action = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
            child: Wrap(children: [
              ListTile(
                leading: const Icon(Icons.edit_outlined),
                title: const Text('Editar informações'),
                subtitle: const Text(
                    'Nome, função, equipe, matrícula, farda e calçado'),
                onTap: () => Navigator.pop(sheetContext, 'edit'),
              ),
              ListTile(
                leading: const Icon(Icons.playlist_add_check_rounded),
                title: const Text('Gerenciar itens previstos'),
                subtitle: const Text(
                    'Adicionar ou remover EPI, farda e itens pessoais'),
                onTap: () => Navigator.pop(sheetContext, 'items'),
              ),
            ]),
          ));
  if (!context.mounted) return;
  await Future<void>.delayed(const Duration(milliseconds: 250));
  if (!context.mounted) return;
  if (action == 'edit') {
    if (await _employeeForm(context, repo, teams, existing: person) &&
        context.mounted) {
      onChanged();
      _message(context, 'Funcionário atualizado.');
    }
  } else if (action == 'items') {
    if (await _employeeItemsForm(context, repo, person) && context.mounted) {
      onChanged();
      _message(context, 'Itens previstos atualizados.');
    }
  }
}

Future<bool> _employeeItemsForm(BuildContext context, MetalloRepository repo,
    Map<String, dynamic> person) async {
  List<Map<String, dynamic>> items;
  Map<String, dynamic> saved;
  try {
    final values = await Future.wait<dynamic>([
      repo.fetchEpiItems(),
      repo.fetchEpiEmployeeItemSet(person['id'].toString()),
    ]);
    items = List<Map<String, dynamic>>.from(values[0] as List);
    saved = Map<String, dynamic>.from(values[1] as Map);
  } catch (_) {
    if (context.mounted)
      _message(context, 'Não foi possível carregar os itens.');
    return false;
  }
  if (!context.mounted) return false;
  final selected = <String, int>{};
  if (saved['configured'] == true) {
    for (final row in saved['rows'] as List<Map<String, dynamic>>) {
      selected[row['item_id'].toString()] =
          (row['required_quantity'] as num?)?.toInt() ?? 1;
    }
  } else {
    for (final kind in ['epi', 'uniform', 'personal_tool']) {
      for (final rec
          in _recommendedCodes(person['profession']?.toString() ?? '', kind)) {
        final item = items.where((i) => i['code'] == rec.$1).firstOrNull;
        if (item != null) selected[item['id'].toString()] = rec.$2;
      }
    }
  }
  String kind = 'epi';
  String query = '';
  bool busy = false;
  String? error;
  final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
            builder: (context, setLocal) {
              final visible = items.where((item) {
                final text = '${item['name']} ${item['code']}'.toLowerCase();
                return item['item_kind'] == kind &&
                    text.contains(query.trim().toLowerCase());
              }).toList();
              return AlertDialog(
                insetPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
                titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                contentPadding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                actionsPadding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
                title: Text('Itens de ${person['full_name']}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w800)),
                content: SizedBox(
                  width: 520,
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    TextField(
                      onChanged: (value) => setLocal(() => query = value),
                      decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          hintText: 'Pesquisar item'),
                    ),
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'epi', label: Text('EPIs')),
                          ButtonSegment(
                              value: 'personal_tool', label: Text('Pessoais')),
                          ButtonSegment(
                              value: 'uniform', label: Text('Fardas')),
                        ],
                        selected: {kind},
                        onSelectionChanged: (value) =>
                            setLocal(() => kind = value.first),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Flexible(
                      child: ListView(
                        shrinkWrap: true,
                        children: [
                          for (final item in visible)
                            _EmployeeItemSelector(
                              item: item,
                              quantity: selected[item['id'].toString()],
                              enabled: !busy,
                              onToggle: (checked) => setLocal(() {
                                final id = item['id'].toString();
                                if (checked) {
                                  selected[id] = 1;
                                } else {
                                  selected.remove(id);
                                }
                              }),
                              onDecrease: () => setLocal(() {
                                final id = item['id'].toString();
                                if ((selected[id] ?? 1) > 1)
                                  selected[id] = selected[id]! - 1;
                              }),
                              onIncrease: () => setLocal(() {
                                final id = item['id'].toString();
                                selected[id] = (selected[id] ?? 0) + 1;
                              }),
                            ),
                        ],
                      ),
                    ),
                    if (error != null)
                      Text(error!,
                          style: const TextStyle(color: Colors.redAccent)),
                  ]),
                ),
                actions: [
                  TextButton(
                      onPressed: busy
                          ? null
                          : () => Navigator.pop(dialogContext, false),
                      child: const Text('Cancelar')),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () async {
                            setLocal(() {
                              busy = true;
                              error = null;
                            });
                            try {
                              await repo.setEpiEmployeeItems(
                                  person['id'].toString(),
                                  selected.entries
                                      .map((e) => {
                                            'item_id': e.key,
                                            'quantity': e.value
                                          })
                                      .toList());
                              if (dialogContext.mounted) {
                                Navigator.pop(dialogContext, true);
                              }
                            } catch (_) {
                              setLocal(() {
                                busy = false;
                                error = 'Não foi possível salvar os itens.';
                              });
                            }
                          },
                    child: Text(busy ? 'Salvando...' : 'Salvar'),
                  ),
                ],
              );
            },
          ));
  return result ?? false;
}

class _EmployeeItemSelector extends StatelessWidget {
  const _EmployeeItemSelector({
    required this.item,
    required this.quantity,
    required this.enabled,
    required this.onToggle,
    required this.onDecrease,
    required this.onIncrease,
  });

  final Map<String, dynamic> item;
  final int? quantity;
  final bool enabled;
  final ValueChanged<bool> onToggle;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;

  @override
  Widget build(BuildContext context) {
    final selected = quantity != null;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: selected ? _epiBlue.withValues(alpha: .08) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Checkbox(
          value: selected,
          onChanged: enabled ? (value) => onToggle(value ?? false) : null,
        ),
        const SizedBox(width: 4),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item['name']?.toString() ?? 'Item',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(item['code']?.toString() ?? '',
                style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ]),
        ),
        if (selected) ...[
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: enabled && quantity! > 1 ? onDecrease : null,
            icon: const Icon(Icons.remove_circle_outline, size: 21),
          ),
          SizedBox(
            width: 22,
            child: Text('$quantity',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
          IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: enabled ? onIncrease : null,
            icon: const Icon(Icons.add_circle_outline, size: 21),
          ),
        ],
      ]),
    );
  }
}

Future<bool> _itemForm(BuildContext context, MetalloRepository repo,
    {Map<String, dynamic>? existing}) async {
  final form = GlobalKey<FormState>();
  final code = TextEditingController(text: existing?['code']?.toString() ?? '');
  final name = TextEditingController(text: existing?['name']?.toString() ?? '');
  final unit =
      TextEditingController(text: existing?['unit']?.toString() ?? 'un');
  final ca =
      TextEditingController(text: existing?['ca_number']?.toString() ?? '');
  final brand =
      TextEditingController(text: existing?['brand_model']?.toString() ?? '');
  final minimum = TextEditingController(
      text: existing?['minimum_stock']?.toString() ?? '0');
  String kind = existing?['item_kind']?.toString() ?? 'epi';
  bool busy = false;
  String? error;
  final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
                title:
                    Text(existing == null ? 'Cadastrar item' : 'Editar item'),
                content: Form(
                    key: form,
                    child: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      DropdownButtonFormField<String>(
                          initialValue: kind,
                          decoration: const InputDecoration(labelText: 'Tipo'),
                          items: const [
                            DropdownMenuItem(value: 'epi', child: Text('EPI')),
                            DropdownMenuItem(
                                value: 'uniform', child: Text('Fardamento')),
                            DropdownMenuItem(
                                value: 'personal_tool',
                                child: Text('Item pessoal'))
                          ],
                          onChanged: (v) => setLocal(() => kind = v ?? 'epi')),
                      const SizedBox(height: 10),
                      TextFormField(
                          controller: code,
                          decoration:
                              const InputDecoration(labelText: 'Código'),
                          validator: (v) => (v?.trim().isEmpty ?? true)
                              ? 'Informe o código.'
                              : null),
                      const SizedBox(height: 10),
                      TextFormField(
                          controller: name,
                          decoration: const InputDecoration(labelText: 'Nome'),
                          validator: (v) => (v?.trim().isEmpty ?? true)
                              ? 'Informe o nome.'
                              : null),
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                            child: TextFormField(
                                controller: unit,
                                decoration: const InputDecoration(
                                    labelText: 'Unidade'))),
                        const SizedBox(width: 8),
                        Expanded(
                            child: TextFormField(
                                controller: minimum,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                    labelText: 'Estoque mínimo')))
                      ]),
                      const SizedBox(height: 10),
                      if (kind == 'epi')
                        TextFormField(
                            controller: ca,
                            decoration: const InputDecoration(
                                labelText: 'CA padrão (opcional)')),
                      if (kind == 'epi') const SizedBox(height: 10),
                      TextFormField(
                          controller: brand,
                          decoration: const InputDecoration(
                              labelText: 'Marca / modelo (opcional)')),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text(error!,
                                style:
                                    const TextStyle(color: Colors.redAccent))),
                    ]))),
                actions: [
                  TextButton(
                      onPressed: busy
                          ? null
                          : () => Navigator.pop(dialogContext, false),
                      child: const Text('Cancelar')),
                  FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (!(form.currentState?.validate() ?? false))
                                return;
                              setLocal(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                if (existing == null) {
                                  await repo.createEpiItem(
                                      code: code.text,
                                      name: name.text,
                                      kind: kind,
                                      unit: unit.text,
                                      caNumber: ca.text,
                                      brandModel: brand.text,
                                      minimumStock:
                                          int.tryParse(minimum.text) ?? 0);
                                } else {
                                  await repo.updateEpiItem(
                                      id: existing['id'].toString(),
                                      code: code.text,
                                      name: name.text,
                                      kind: kind,
                                      unit: unit.text,
                                      caNumber: ca.text,
                                      brandModel: brand.text,
                                      minimumStock:
                                          int.tryParse(minimum.text) ?? 0);
                                }
                                if (dialogContext.mounted)
                                  Navigator.pop(dialogContext, true);
                              } catch (_) {
                                setLocal(() {
                                  busy = false;
                                  error =
                                      'Não foi possível salvar. O código pode já existir.';
                                });
                              }
                            },
                      child: Text(busy ? 'Salvando...' : 'Salvar'))
                ],
              )));
  await Future<void>.delayed(const Duration(milliseconds: 350));
  code.dispose();
  name.dispose();
  unit.dispose();
  ca.dispose();
  brand.dispose();
  minimum.dispose();
  return result ?? false;
}

Future<void> _itemActions(BuildContext context, MetalloRepository repo,
    Map<String, dynamic> item, VoidCallback reload) async {
  final action = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
            child: Wrap(children: [
              ListTile(
                  leading: const Icon(Icons.edit_outlined),
                  title: const Text('Editar item'),
                  subtitle: const Text(
                      'Alterar nome, código, tipo, CA e demais dados'),
                  onTap: () => Navigator.pop(sheetContext, 'edit')),
              ListTile(
                  leading:
                      const Icon(Icons.delete_outline, color: Colors.redAccent),
                  title: const Text('Apagar item'),
                  subtitle:
                      const Text('Retirar do catálogo sem perder o histórico'),
                  onTap: () => Navigator.pop(sheetContext, 'delete')),
            ]),
          ));
  if (!context.mounted) return;
  if (action == 'edit') {
    if (await _itemForm(context, repo, existing: item) && context.mounted) {
      reload();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Item atualizado.')));
    }
  } else if (action == 'delete') {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Apagar item?'),
            content: Text(
                '${item['name']} será retirado do catálogo. Entregas anteriores continuarão no histórico.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Cancelar')),
              FilledButton(
                  onPressed: () => Navigator.pop(dialogContext, true),
                  style: FilledButton.styleFrom(backgroundColor: Colors.red),
                  child: const Text('Apagar')),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    try {
      await repo.deactivateEpiItem(item['id'].toString());
      if (!context.mounted) return;
      reload();
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Item apagado do catálogo.')));
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Não foi possível apagar o item.')));
      }
    }
  }
}

Future<bool> _stockForm(BuildContext context, MetalloRepository repo,
    Map<String, dynamic> item) async {
  final form = GlobalKey<FormState>();
  final quantity = TextEditingController();
  final ca = TextEditingController(text: item['ca_number']?.toString() ?? '');
  final brand =
      TextEditingController(text: item['brand_model']?.toString() ?? '');
  final lot = TextEditingController();
  String? variant;
  bool busy = false;
  String? error;
  final isEpi = item['item_kind'] == 'epi';
  final isBoot = item['code'] == 'EPI-BOT';
  final isGlasses = item['code'] == 'EPI-OCU';
  final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
                title: Text('Entrada: ${item['name']}'),
                content: Form(
                    key: form,
                    child: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      TextFormField(
                          controller: quantity,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'Quantidade recebida'),
                          validator: (v) => (int.tryParse(v ?? '') ?? 0) <= 0
                              ? 'Informe uma quantidade válida.'
                              : null),
                      if (isBoot || isGlasses) const SizedBox(height: 10),
                      if (isBoot)
                        DropdownButtonFormField<String>(
                          initialValue: variant,
                          decoration: const InputDecoration(
                              labelText: 'Número da botina'),
                          items: [
                            for (var size = 38; size <= 46; size++)
                              DropdownMenuItem(
                                  value: '$size', child: Text('Número $size')),
                          ],
                          onChanged: (value) => setLocal(() => variant = value),
                          validator: (value) => value == null
                              ? 'Selecione o número da botina.'
                              : null,
                        ),
                      if (isGlasses)
                        DropdownButtonFormField<String>(
                          initialValue: variant,
                          decoration: const InputDecoration(
                              labelText: 'Tipo do óculos de proteção'),
                          items: const [
                            DropdownMenuItem(
                                value: 'Claro', child: Text('Claro')),
                            DropdownMenuItem(
                                value: 'Escuro', child: Text('Escuro')),
                          ],
                          onChanged: (value) => setLocal(() => variant = value),
                          validator: (value) => value == null
                              ? 'Selecione o tipo do óculos.'
                              : null,
                        ),
                      if (isEpi) const SizedBox(height: 10),
                      if (isEpi)
                        TextFormField(
                            controller: ca,
                            decoration: const InputDecoration(
                                labelText: 'CA desta remessa'),
                            validator: (v) => (v?.trim().isEmpty ?? true)
                                ? 'Informe o CA entregue pelo fornecedor.'
                                : null),
                      const SizedBox(height: 10),
                      TextFormField(
                          controller: brand,
                          decoration: const InputDecoration(
                              labelText: 'Marca / modelo')),
                      const SizedBox(height: 10),
                      TextFormField(
                          controller: lot,
                          decoration: const InputDecoration(
                              labelText: 'Lote (opcional)')),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.only(top: 10),
                            child: Text(error!,
                                style:
                                    const TextStyle(color: Colors.redAccent))),
                    ]))),
                actions: [
                  TextButton(
                      onPressed: busy
                          ? null
                          : () => Navigator.pop(dialogContext, false),
                      child: const Text('Cancelar')),
                  FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (!(form.currentState?.validate() ?? false))
                                return;
                              setLocal(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                await repo.addEpiStock(
                                    itemId: item['id'].toString(),
                                    quantity: int.parse(quantity.text),
                                    caNumber: ca.text,
                                    brandModel: brand.text,
                                    lotNumber: lot.text,
                                    variant: variant);
                                if (dialogContext.mounted)
                                  Navigator.pop(dialogContext, true);
                              } catch (_) {
                                setLocal(() {
                                  busy = false;
                                  error =
                                      'Não foi possível registrar a entrada.';
                                });
                              }
                            },
                      child: Text(busy ? 'Salvando...' : 'Registrar entrada'))
                ],
              )));
  await Future<void>.delayed(const Duration(milliseconds: 350));
  quantity.dispose();
  ca.dispose();
  brand.dispose();
  lot.dispose();
  return result ?? false;
}

void _openEmployeeDetails(
    BuildContext context, MetalloRepository repo, Map<String, dynamic> person) {
  Navigator.push(
      context,
      MaterialPageRoute(
          builder: (_) => _EmployeeDetailsPage(repo: repo, person: person)));
}

class _EmployeeDetailsPage extends StatefulWidget {
  const _EmployeeDetailsPage({required this.repo, required this.person});
  final MetalloRepository repo;
  final Map<String, dynamic> person;

  @override
  State<_EmployeeDetailsPage> createState() => _EmployeeDetailsPageState();
}

class _EmployeeDetailsPageState extends State<_EmployeeDetailsPage> {
  late Future<List<dynamic>> future = _load();

  Future<List<dynamic>> _load() => Future.wait<dynamic>([
        widget.repo.fetchEpiDeliveries(),
        widget.repo.fetchEpiItems(),
        widget.repo.fetchEpiRequests(),
        widget.repo.fetchEpiEmployeeItemSet(widget.person['id'].toString()),
      ]);

  void reload() => setState(() => future = _load());

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: AppBar(title: const Text('Funcionário')),
          body: Column(children: [
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: _epiCard,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFF17324B))),
              child: Row(children: [
                const CircleAvatar(
                    radius: 32,
                    backgroundColor: Color(0xFF0C355C),
                    child:
                        Icon(Icons.person_outline, color: _epiBlue, size: 35)),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(
                          widget.person['full_name']?.toString() ??
                              'Funcionário',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w900)),
                      Text(
                          '${widget.person['profession']} • ${(widget.person['teams'] as Map?)?['name'] ?? 'Sem equipe'}',
                          style: const TextStyle(color: Colors.white60)),
                      Text(
                          'Farda ${widget.person['shirt_size'] ?? '-'} • Calçado ${widget.person['shoe_size'] ?? '-'}',
                          style: const TextStyle(
                              color: Color(0xFF75BBFF), fontSize: 12)),
                    ]))
              ]),
            ),
            const TabBar(tabs: [
              Tab(text: 'EPI'),
              Tab(text: 'Fardamento'),
              Tab(text: 'Itens pessoais')
            ]),
            Expanded(
                child: FutureBuilder<List<dynamic>>(
              future: future,
              builder: (context, snap) {
                if (snap.hasError) return _ModuleError(onRetry: reload);
                if (!snap.hasData)
                  return const Center(child: CircularProgressIndicator());
                final rows = (snap.data![0] as List<Map<String, dynamic>>)
                    .where((d) =>
                        d['employee_id']?.toString() ==
                        widget.person['id']?.toString())
                    .toList();
                final items = snap.data![1] as List<Map<String, dynamic>>;
                final requests = (snap.data![2] as List<Map<String, dynamic>>)
                    .where((r) =>
                        r['employee_id']?.toString() ==
                        widget.person['id']?.toString())
                    .toList();
                final itemSet = Map<String, dynamic>.from(snap.data![3] as Map);
                final customItems = itemSet['configured'] == true
                    ? List<Map<String, dynamic>>.from(itemSet['rows'] as List)
                    : null;
                return TabBarView(children: [
                  _AssignmentList(
                      kind: 'epi',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                  _AssignmentList(
                      kind: 'uniform',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                  _AssignmentList(
                      kind: 'personal_tool',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                ]);
              },
            )),
          ]),
        ),
      );
}

class _AssignmentList extends StatelessWidget {
  const _AssignmentList(
      {required this.kind,
      required this.profession,
      required this.rows,
      required this.items,
      required this.requests,
      required this.person,
      required this.customItems,
      required this.repo,
      required this.onChanged});
  final String kind, profession;
  final List<Map<String, dynamic>> rows;
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> requests;
  final Map<String, dynamic> person;
  final List<Map<String, dynamic>>? customItems;
  final MetalloRepository repo;
  final VoidCallback onChanged;
  @override
  Widget build(BuildContext context) {
    final delivered = rows
        .where((r) =>
            (r['epi_items'] as Map?)?['item_kind'] == kind &&
            r['current_status'] == 'active')
        .toList();
    final recommended = customItems == null
        ? _recommendedCodes(profession, kind)
        : customItems!
            .map((row) {
              final item = items
                  .where((i) => i['id'].toString() == row['item_id'].toString())
                  .firstOrNull;
              if (item == null || item['item_kind'] != kind) return null;
              return (
                item['code'].toString(),
                (row['required_quantity'] as num?)?.toInt() ?? 1
              );
            })
            .whereType<(String, int)>()
            .toList();
    return ListView(padding: const EdgeInsets.all(16), children: [
      for (final rec in recommended)
        if (items.where((i) => i['code'] == rec.$1).firstOrNull
            case final item?)
          Builder(builder: (context) {
            final itemId = item['id'].toString();
            final itemDeliveries = delivered
                .where((r) => r['item_id']?.toString() == itemId)
                .toList();
            final deliveredQty = itemDeliveries.fold<int>(
                0, (sum, r) => sum + ((r['quantity'] as num?)?.toInt() ?? 0));
            final variants = itemDeliveries
                .map((r) => r['variant_snapshot']?.toString().trim())
                .whereType<String>()
                .where((value) => value.isNotEmpty)
                .toSet();
            final variantDetail = variants.isEmpty
                ? null
                : item['code'] == 'EPI-BOT'
                    ? 'Número ${variants.join(', ')}'
                    : variants.join(', ');
            final pendingRequest = requests
                .where((r) =>
                    r['item_id']?.toString() == itemId &&
                    r['status'] == 'pending')
                .firstOrNull;
            final pending = pendingRequest != null;
            final pendingVariant =
                pendingRequest?['requested_variant']?.toString();
            return _assignmentCard(item['name']?.toString() ?? 'Item',
                '$deliveredQty/${rec.$2}', deliveredQty >= rec.$2, null,
                detail: variantDetail ??
                    (pendingVariant == null
                        ? null
                        : 'Solicitado: $pendingVariant • aguardando COSEM'),
                pending: pending,
                onTap: deliveredQty >= rec.$2 || pending
                    ? null
                    : () => _request(context, item, rec.$2 - deliveredQty));
          }),
      for (final row in delivered.where((r) =>
          !recommended.any((x) => x.$1 == (r['epi_items'] as Map?)?['code'])))
        _assignmentCard(
            (row['epi_items'] as Map?)?['name']?.toString() ?? 'Item',
            '${row['quantity']} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'}',
            true,
            row['ca_snapshot']?.toString(),
            detail: row['variant_snapshot'] == null
                ? null
                : '${(row['epi_items'] as Map?)?['code'] == 'EPI-BOT' ? 'Número ' : ''}${row['variant_snapshot']}'),
      if (recommended.isEmpty && delivered.isEmpty)
        const Center(
            child: Padding(
                padding: EdgeInsets.all(30),
                child: Text('Nenhum item previsto para esta função.'))),
    ]);
  }

  Future<void> _request(
      BuildContext context, Map<String, dynamic> item, int quantity) async {
    final teamId = person['team_id']?.toString();
    if (teamId == null) {
      _message(context, 'Associe o funcionário a uma equipe primeiro.');
      return;
    }
    String? requestedVariant;
    if (item['code'] == 'EPI-OCU') {
      requestedVariant = await showModalBottomSheet<String>(
        context: context,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('Qual óculos deve ser solicitado?',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              ListTile(
                leading: const Icon(Icons.light_mode_outlined, color: _epiBlue),
                title: const Text('Óculos claro'),
                onTap: () => Navigator.pop(sheetContext, 'Claro'),
              ),
              ListTile(
                leading: const Icon(Icons.dark_mode_outlined, color: _epiBlue),
                title: const Text('Óculos escuro'),
                onTap: () => Navigator.pop(sheetContext, 'Escuro'),
              ),
            ]),
          ),
        ),
      );
      if (requestedVariant == null) return;
    }
    try {
      await repo.requestEpiItem(
          employeeId: person['id'].toString(),
          teamId: teamId,
          itemId: item['id'].toString(),
          quantity: quantity,
          requestedVariant: requestedVariant);
      if (context.mounted) {
        _message(context, 'Solicitação enviada para a COSEM.');
        onChanged();
      }
    } catch (_) {
      if (context.mounted)
        _message(context, 'Esta pendência já foi solicitada.');
    }
  }

  Widget _assignmentCard(String name, String qty, bool ok, String? ca,
          {String? detail, bool pending = false, VoidCallback? onTap}) =>
      Card(
          color: _epiCard,
          child: ListTile(
            onTap: onTap,
            leading: Icon(
                ok
                    ? Icons.check_circle
                    : pending
                        ? Icons.schedule_rounded
                        : Icons.warning_amber_rounded,
                color: ok
                    ? Colors.greenAccent
                    : pending
                        ? _epiBlue
                        : Colors.orangeAccent),
            title:
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(detail ??
                (ca == null
                    ? (ok
                        ? 'Entregue'
                        : pending
                            ? 'Solicitação enviada • aguardando COSEM'
                            : 'Pendente • toque para solicitar')
                    : 'CA $ca')),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: (ok
                        ? Colors.greenAccent
                        : pending
                            ? _epiBlue
                            : Colors.orangeAccent)
                    .withValues(alpha: .12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(qty,
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: ok
                          ? Colors.greenAccent
                          : pending
                              ? _epiBlue
                              : Colors.orangeAccent)),
            ),
          ));
}

List<(String, int)> _recommendedCodes(String profession, String kind) {
  final common = ['EPI-CAP', 'EPI-OCU', 'EPI-AUR', 'EPI-BOT'];
  final p = profession.toLowerCase();
  if (kind == 'uniform')
    return [(p == 'encarregado' ? 'FARD-AZUL' : 'FARD-CINZA', 2)];
  if (kind == 'personal_tool') {
    if (p == 'montador' || p == 'encarregado')
      return [
        ('PES-TRENA', 1),
        ('PES-ESQ', 1),
        ('PES-RISC', 1),
        ('PES-LAPIS', 1)
      ];
    if (p == 'soldador') return [('PES-BAT-SOLDA', 1)];
    return [];
  }
  var items = [...common];
  if (p == 'soldador')
    items.addAll(['EPI-LUV-RASPA', 'EPI-MASC-SOLDA', 'EPI-AVENTAL']);
  if (p == 'montador' || p == 'encarregado' || p == 'ajudante')
    items.add('EPI-LUV-RASPA');
  if (p.contains('operador de munck')) {
    items = ['EPI-LUV-RASPA', 'EPI-AUR', 'EPI-OCU', 'EPI-BOT'];
  }
  if (p == 'pintor') items.add('EPI-RESP-PINT');
  return items.map((x) => (x, 1)).toList();
}

Widget _detail(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(children: [
      Icon(icon, color: _epiBlue),
      const SizedBox(width: 12),
      Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(color: Colors.white54, fontSize: 12)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700))
      ]))
    ]));

void _deliveryGroupDetails(BuildContext context, MetalloRepository repo,
    List<Map<String, dynamic>> rows, VoidCallback onChanged) {
  showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => SafeArea(
          child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Itens entregues',
                        style: const TextStyle(
                            fontSize: 22, fontWeight: FontWeight.w900)),
                    Text(
                        (rows.first['epi_employees'] as Map?)?['full_name']
                                ?.toString() ??
                            '',
                        style: const TextStyle(color: Colors.white60)),
                    const SizedBox(height: 14),
                    _detail(
                        Icons.groups_2_outlined,
                        'Equipe',
                        (rows.first['teams'] as Map?)?['name']?.toString() ??
                            '-'),
                    const Divider(height: 24),
                    Flexible(
                      child: ListView(
                        shrinkWrap: true,
                        children: [
                          for (final row in rows)
                            Card(
                              color: _epiCard,
                              child: ListTile(
                                leading: Icon(
                                    _kindIcon(
                                        (row['epi_items'] as Map?)?['item_kind']
                                            ?.toString()),
                                    color: _epiBlue),
                                title: Text(
                                    (row['epi_items'] as Map?)?['name']
                                            ?.toString() ??
                                        'Item',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800)),
                                subtitle: Text(
                                    '${row['quantity']} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'} • ${_statusLabel(row['current_status']?.toString())}${row['variant_snapshot'] == null ? '' : ' • ${(row['epi_items'] as Map?)?['code'] == 'EPI-BOT' ? 'Nº ' : ''}${row['variant_snapshot']}'}${row['ca_snapshot'] == null ? '' : ' • CA ${row['ca_snapshot']}'}'),
                                trailing: row['current_status'] == 'active'
                                    ? const Icon(Icons.chevron_right_rounded)
                                    : null,
                                onTap: row['current_status'] == 'active'
                                    ? () async {
                                        final status =
                                            await showModalBottomSheet<String>(
                                                context: sheetContext,
                                                builder: (actionContext) =>
                                                    SafeArea(
                                                      child: Wrap(children: [
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .keyboard_return),
                                                            title: const Text(
                                                                'Devolvido'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'returned')),
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .build_outlined),
                                                            title: const Text(
                                                                'Danificado'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'damaged')),
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .help_outline),
                                                            title: const Text(
                                                                'Perdido'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'lost')),
                                                      ]),
                                                    ));
                                        if (status == null) return;
                                        await repo.closeEpiDelivery(
                                            row['id'].toString(), status);
                                        if (sheetContext.mounted) {
                                          Navigator.pop(sheetContext);
                                          onChanged();
                                          _message(context,
                                              'Situação do item atualizada.');
                                        }
                                      }
                                    : null,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ]))));
}
