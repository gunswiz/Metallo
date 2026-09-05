import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/equipment_ownership.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/shared/widgets/equipment_ownership_badge.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/equipment/dialogs.dart';

class EquipmentCatalogDrawer extends StatefulWidget {
  const EquipmentCatalogDrawer({
    super.key,
    required this.repo,
    required this.isAdmin,
    required this.teams,
  });
  final CatalogRepository repo;
  final bool isAdmin;
  final List<Team> teams;

  @override
  State<EquipmentCatalogDrawer> createState() => _EquipmentCatalogDrawerState();
}

class _EquipmentCatalogDrawerState extends State<EquipmentCatalogDrawer> {
  late Future<List<Map<String, dynamic>>> catalog =
      widget.repo.fetchEquipmentCatalog();
  void reload() => setState(() {
        catalog = widget.repo.fetchEquipmentCatalog();
      });

  Future<void> _handleCatalogAction(
    BuildContext context,
    String action,
    Map<String, dynamic> equipment,
  ) async {
    if (action == 'edit') {
      final changed = await showEditEquipmentCatalogDialog(
        context,
        widget.repo,
        widget.teams,
        equipment,
      );
      if (changed == true) reload();
      return;
    }

    if (action != 'delete') return;
    final confirmed = await confirm(
      context,
      'Excluir equipamento?',
      'O equipamento será desativado e deixará de aparecer no estoque e no catálogo. O histórico será preservado.',
    );
    if (confirmed != true) return;
    try {
      await widget.repo.deactivateEquipmentAsset(equipment['id'].toString());
      reload();
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  Widget build(BuildContext context) => Drawer(
        width: MediaQuery.sizeOf(context).width * .90,
        backgroundColor: metalloDrawerBackground,
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 8, 10),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Catálogo de equipamentos',
                              style: TextStyle(
                                  fontSize: 21, fontWeight: FontWeight.w900)),
                          Text('Ordenado pelo código individual',
                              style: TextStyle(color: Colors.white60)),
                        ],
                      ),
                    ),
                    IconButton(
                        onPressed: reload, icon: const Icon(Icons.refresh)),
                    IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: catalog,
                  builder: (context, snap) {
                    if (snap.hasError) return ErrorState(error: snap.error);
                    if (!snap.hasData) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snap.data!.isEmpty) {
                      return const Center(
                          child: Text('Nenhum equipamento cadastrado.'));
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.all(10),
                      itemCount: snap.data!.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final e = snap.data![i];
                        return _EquipmentCatalogRow(
                          equipment: e,
                          canEdit: widget.isAdmin,
                          onAction: (action) =>
                              _handleCatalogAction(context, action, e),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
}

class _EquipmentCatalogRow extends StatelessWidget {
  const _EquipmentCatalogRow({
    required this.equipment,
    required this.canEdit,
    required this.onAction,
  });

  final Map<String, dynamic> equipment;
  final bool canEdit;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) {
    final item = equipment['items'] as Map?;
    final team = equipment['teams'] as Map?;
    final ownership = parseEquipmentOwnership(equipment['notes'] as String?);
    return ListTile(
      leading: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFF26313D),
          borderRadius: BorderRadius.circular(9),
        ),
        child: Text(
          equipment['asset_code']?.toString() ?? '-',
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Color(0xFFCFD8E3),
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
      title: Row(children: [
        Expanded(
          child: Text(equipmentTypeDisplayName(
              item?['name']?.toString() ?? 'Equipamento')),
        ),
        EquipmentOwnershipBadge(type: ownership.type),
      ]),
      subtitle: Text([
        if ((item?['code']?.toString() ?? '').isNotEmpty)
          'modelo ${item?['code']}',
        if ((team?['name']?.toString() ?? '').isNotEmpty)
          team?['name'].toString(),
        if (ownership.isRented && ownership.rentalCompany?.isNotEmpty == true)
          ownership.rentalCompany!,
        if (ownership.isRented && ownership.rentalEndDate?.isNotEmpty == true)
          'até ${ownership.rentalEndDate}',
        statusLabel(equipment['status']?.toString() ?? 'available'),
      ].join(' • ')),
      trailing: canEdit
          ? PopupMenuButton<String>(
              onSelected: onAction,
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'edit', child: Text('Editar')),
                PopupMenuItem(value: 'delete', child: Text('Excluir')),
              ],
            )
          : null,
    );
  }
}
