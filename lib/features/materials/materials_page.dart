import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/material_stock.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/empty_state.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/materials/material_catalog_drawer.dart';
import 'package:metallo/features/materials/dialogs.dart';

class MaterialsPage extends StatefulWidget {
  const MaterialsPage({
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
  State<MaterialsPage> createState() => _MaterialsPageState();
}

class _MaterialsPageState extends State<MaterialsPage> {
  final search = TextEditingController();

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
        final materials = data.materials.where((m) {
          if (q.isEmpty) return true;
          final team = findTeam(data.teams, m.teamId)?.name ?? '';
          return m.name.toLowerCase().contains(q) ||
              m.code.toLowerCase().contains(q) ||
              team.toLowerCase().contains(q);
        }).toList();
        final materialGroups = <String, List<MaterialStock>>{};
        for (final material in materials) {
          materialGroups
              .putIfAbsent(material.itemId, () => <MaterialStock>[])
              .add(material);
        }

        return Scaffold(
          backgroundColor: metalloBackground,
          endDrawer: MaterialCatalogDrawer(
              repo: widget.catalogRepository, isAdmin: widget.role == 'admin'),
          floatingActionButton: canOperate && allowedTeams.isNotEmpty
              ? FloatingActionButton.extended(
                  heroTag: 'material-entry-fab',
                  onPressed: () => showMaterialDialog(
                    context,
                    widget.catalogRepository,
                    allowedTeams,
                    widget.role == 'leader' ? widget.userTeamId : null,
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text('Entrada'),
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
                    hintText: 'Pesquisar material por nome ou código',
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
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.menu_book_outlined,
                        color: metalloAccent),
                    title: const Text('Catálogo de materiais',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text(
                        'Consultar códigos em ordem e gerenciar materiais cadastrados'),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () => Scaffold.of(innerContext).openEndDrawer(),
                  ),
                ),
                const SizedBox(height: 8),
                if (data.materials.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 50),
                    child: EmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: 'Nenhum material em estoque',
                      subtitle:
                          'Use o catálogo para consultar os materiais cadastrados.',
                    ),
                  )
                else if (materials.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyState(
                      icon: Icons.search_off,
                      title: 'Nenhum material encontrado',
                      subtitle: 'Tente pesquisar por outro nome ou código.',
                    ),
                  )
                else
                  for (final group in materialGroups.values)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.inventory_2_outlined,
                            color: metalloAccent),
                        title: Text(group.first.name),
                        subtitle: Text(
                            '${group.length} ${group.length == 1 ? 'local' : 'locais'} • código ${group.first.code}\nToque para ver a distribuição'),
                        isThreeLine: true,
                        trailing: Text(
                            '${group.fold<int>(0, (sum, item) => sum + item.quantity)} ${group.first.unit}',
                            style: const TextStyle(
                                color: metalloAccent,
                                fontWeight: FontWeight.w900)),
                        onTap: () => showMaterialDistributionSheet(
                          context,
                          widget.movementRepository,
                          data.teams,
                          group,
                          widget.role,
                          widget.userTeamId,
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
