import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/equipment_asset.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/empty_state.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/equipment/grouping.dart';
import 'package:metallo/features/equipment/equipment_catalog_drawer.dart';
import 'package:metallo/features/equipment/dialogs.dart';

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
        final canOperate = canOperateEquipment(widget.role);
        final allowedTeams =
            allowedEquipmentTeams(data.teams, widget.role, widget.userTeamId);
        final equipment = filterEquipmentAssets(
          data.equipment,
          data.teams,
          ownershipFilter,
          search.text,
        );
        final equipmentGroups = groupEquipmentAssets(equipment);

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
                _EquipmentFilters(
                  searchController: search,
                  ownershipFilter: ownershipFilter,
                  onSearchChanged: () => setState(() {}),
                  onClearSearch: () {
                    search.clear();
                    setState(() {});
                  },
                  onOwnershipChanged: (value) =>
                      setState(() => ownershipFilter = value),
                ),
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
                  for (final group in equipmentGroups)
                    _EquipmentGroupCard(
                      group: group,
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
              ],
            ),
          ),
        );
      },
    );
  }
}

class _EquipmentFilters extends StatelessWidget {
  const _EquipmentFilters({
    required this.searchController,
    required this.ownershipFilter,
    required this.onSearchChanged,
    required this.onClearSearch,
    required this.onOwnershipChanged,
  });

  final TextEditingController searchController;
  final String ownershipFilter;
  final VoidCallback onSearchChanged;
  final VoidCallback onClearSearch;
  final ValueChanged<String> onOwnershipChanged;

  @override
  Widget build(BuildContext context) => Column(children: [
        TextField(
          controller: searchController,
          onChanged: (_) => onSearchChanged(),
          decoration: InputDecoration(
            hintText: 'Pesquisar equipamento por nome ou código',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: searchController.text.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Limpar pesquisa',
                    onPressed: onClearSearch,
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
              icon: Icon(Icons.apps_rounded),
            ),
            ButtonSegment(
              value: 'owned',
              label: Text('Próprios'),
              icon: Icon(Icons.business_rounded),
            ),
            ButtonSegment(
              value: 'rented',
              label: Text('Alugados'),
              icon: Icon(Icons.key_rounded),
            ),
          ],
          selected: {ownershipFilter},
          onSelectionChanged: (value) => onOwnershipChanged(value.first),
        ),
      ]);
}

class _EquipmentGroupCard extends StatelessWidget {
  const _EquipmentGroupCard({required this.group, required this.onTap});

  final List<EquipmentAsset> group;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: const Icon(Icons.handyman_outlined),
          title: Text(equipmentFamilyLabel(group)),
          subtitle: Text(equipmentGroupSummary(group)),
          isThreeLine: true,
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: onTap,
        ),
      );
}
