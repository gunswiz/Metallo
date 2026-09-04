part of '../../app.dart';

class EquipmentPage extends StatefulWidget {
  const EquipmentPage({
    super.key,
    required this.catalogRepository,
    required this.movementRepository,
    required this.stream,
    required this.role,
    required this.userTeamId,
  });
  final CatalogRepository catalogRepository;
  final MovementRepository movementRepository;
  final Stream<DashboardSnapshot> stream;
  final String role;
  final String? userTeamId;

  @override
  State<EquipmentPage> createState() => _EquipmentPageState();
}

class _EquipmentPageState extends State<EquipmentPage> {
  final search = TextEditingController();
  String ownershipFilter = 'all';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.stream,
      builder: (context, snap) {
        if (snap.hasError) return ErrorState(error: snap.error);
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snap.data!;
        final canOperate = widget.role == 'admin' ||
            widget.role == 'engineer' ||
            widget.role == 'leader';
        final allowedTeams = widget.role == 'leader'
            ? data.teams.where((t) => t.id == widget.userTeamId).toList()
            : data.teams;
        final q = search.text.trim().toLowerCase();
        final equipment = data.equipment.where((e) {
          if (ownershipFilter != 'all' && e.ownershipType != ownershipFilter) {
            return false;
          }
          if (q.isEmpty) return true;
          final team = findTeam(data.teams, e.teamId)?.name ?? '';
          return e.name.toLowerCase().contains(q) ||
              e.assetCode.toLowerCase().contains(q) ||
              (e.rentalCompany?.toLowerCase().contains(q) ?? false) ||
              team.toLowerCase().contains(q);
        }).toList();
        final equipmentGroups = <String, List<EquipmentAsset>>{};
        for (final asset in equipment) {
          equipmentGroups
              .putIfAbsent(equipmentFamilyKey(asset), () => <EquipmentAsset>[])
              .add(asset);
        }

        return Scaffold(
          backgroundColor: metalloBackground,
          endDrawer: EquipmentCatalogDrawer(
              repo: widget.catalogRepository,
              isAdmin: widget.role == 'admin',
              teams: data.teams),
          floatingActionButton: canOperate && allowedTeams.isNotEmpty
              ? FloatingActionButton.extended(
                  heroTag: 'equipment-create-fab',
                  onPressed: () => showEquipmentDialog(
                    context,
                    widget.catalogRepository,
                    allowedTeams,
                    widget.role == 'leader' ? widget.userTeamId : null,
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text('Novo equipamento'),
                )
              : null,
          body: Builder(
            builder: (innerContext) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              children: [
                TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Pesquisar equipamento por nome ou código',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: search.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Limpar pesquisa',
                            onPressed: () {
                              search.clear();
                              setState(() {});
                            },
                            icon: const Icon(Icons.close),
                          ),
                  ),
                ),
                const SizedBox(height: 10),
                SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                          value: 'all',
                          label: Text('Todos'),
                          icon: Icon(Icons.apps_rounded)),
                      ButtonSegment(
                          value: 'owned',
                          label: Text('Próprios'),
                          icon: Icon(Icons.business_rounded)),
                      ButtonSegment(
                          value: 'rented',
                          label: Text('Alugados'),
                          icon: Icon(Icons.key_rounded)),
                    ],
                    selected: {
                      ownershipFilter
                    },
                    onSelectionChanged: (value) =>
                        setState(() => ownershipFilter = value.first)),
                const SizedBox(height: 10),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.menu_book_outlined,
                        color: Colors.blueGrey),
                    title: const Text('Catálogo de equipamentos',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text(
                        'Consultar próprios e alugados por patrimônio'),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () => Scaffold.of(innerContext).openEndDrawer(),
                  ),
                ),
                const SizedBox(height: 8),
                if (data.equipment.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 50),
                    child: EmptyState(
                      icon: Icons.handyman_outlined,
                      title: 'Nenhum equipamento',
                      subtitle: 'Os equipamentos cadastrados aparecerão aqui.',
                    ),
                  )
                else if (equipment.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyState(
                      icon: Icons.search_off,
                      title: 'Nenhum equipamento encontrado',
                      subtitle: 'Tente pesquisar por outro nome ou código.',
                    ),
                  )
                else
                  for (final group in equipmentGroups.values)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.handyman_outlined),
                        title: Text(equipmentFamilyLabel(group)),
                        subtitle: Text(
                            '${group.map((e) => e.itemId).toSet().length} ${group.map((e) => e.itemId).toSet().length == 1 ? 'tipo' : 'tipos'} • ${group.length} ${group.length == 1 ? 'equipamento' : 'equipamentos'}\nToque para ver tipos e patrimônios'),
                        isThreeLine: true,
                        trailing: const Icon(Icons.chevron_right_rounded),
                        onTap: () => showEquipmentFamilySheet(
                          context,
                          widget.catalogRepository,
                          widget.movementRepository,
                          data.teams,
                          group,
                          role: widget.role,
                          userTeamId: widget.userTeamId,
                          canOperate: canOperate,
                        ),
                      ),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}
