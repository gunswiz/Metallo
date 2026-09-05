import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/materials/dialogs.dart';

class MaterialCatalogDrawer extends StatefulWidget {
  const MaterialCatalogDrawer(
      {super.key, required this.repo, required this.isAdmin});
  final CatalogRepository repo;
  final bool isAdmin;

  @override
  State<MaterialCatalogDrawer> createState() => _MaterialCatalogDrawerState();
}

class _MaterialCatalogDrawerState extends State<MaterialCatalogDrawer> {
  late Future<List<Map<String, dynamic>>> catalog =
      widget.repo.fetchMaterialCatalog();
  void reload() => setState(() => catalog = widget.repo.fetchMaterialCatalog());

  Future<void> _handleCatalogAction(
    BuildContext context,
    String action,
    Map<String, dynamic> material,
  ) async {
    if (action == 'edit') {
      final changed =
          await showEditMaterialCatalogDialog(context, widget.repo, material);
      if (changed == true) reload();
      return;
    }

    if (action != 'delete') return;
    final confirmed = await confirm(
      context,
      'Excluir material?',
      'O material será retirado do catálogo. Por segurança, a exclusão só é permitida quando não houver saldo em nenhuma localização. O histórico será preservado.',
    );
    if (confirmed != true) return;
    try {
      await widget.repo.deactivateMaterialItem(material['id'].toString());
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
                child: Row(children: [
                  const Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text('Catálogo de materiais',
                            style: TextStyle(
                                fontSize: 21, fontWeight: FontWeight.w900)),
                        Text('Ordenado pelo código global',
                            style: TextStyle(color: Colors.white60)),
                      ])),
                  IconButton(
                      onPressed: reload, icon: const Icon(Icons.refresh)),
                  IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close)),
                ]),
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
                          child: Text('Nenhum material cadastrado.'));
                    }
                    return ListView.separated(
                      padding: const EdgeInsets.all(10),
                      itemCount: snap.data!.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final material = snap.data![i];
                        return _MaterialCatalogRow(
                          material: material,
                          canEdit: widget.isAdmin,
                          onAction: (action) =>
                              _handleCatalogAction(context, action, material),
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

class _MaterialCatalogRow extends StatelessWidget {
  const _MaterialCatalogRow({
    required this.material,
    required this.canEdit,
    required this.onAction,
  });

  final Map<String, dynamic> material;
  final bool canEdit;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) => ListTile(
        leading: Container(
          constraints: const BoxConstraints(minWidth: 58),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFF0E3965),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            material['code']?.toString() ?? '-',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: metalloCatalogCode,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        title: Text(material['name']?.toString() ?? ''),
        subtitle: Text(
          '${material['unit'] ?? 'un'}${(material['category']?.toString().isNotEmpty ?? false) ? ' • ${material['category']}' : ''}',
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Total: ${(material['total_quantity'] as num?)?.toInt() ?? 0} ${material['unit'] ?? 'un'}',
              style: const TextStyle(
                color: metalloLightBlue,
                fontWeight: FontWeight.w900,
              ),
            ),
            if (canEdit)
              PopupMenuButton<String>(
                onSelected: onAction,
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
          ],
        ),
      );
}
