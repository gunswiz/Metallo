import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/core/validation.dart';
import 'package:metallo/data/models/material_stock.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/shared/widgets/async_action_dialog.dart';

Future<bool?> showEditMaterialCatalogDialog(BuildContext context,
    CatalogRepository repo, Map<String, dynamic> material) async {
  final actionLock =
      UiActionLock.acquire(context, 'showEditMaterialCatalogDialog');
  if (actionLock == null) return null;
  try {
    final code =
        TextEditingController(text: material['code']?.toString() ?? '');
    final name =
        TextEditingController(text: material['name']?.toString() ?? '');
    final unit =
        TextEditingController(text: material['unit']?.toString() ?? 'un');
    final category =
        TextEditingController(text: material['category']?.toString() ?? '');
    final description =
        TextEditingController(text: material['description']?.toString() ?? '');
    try {
      return await showAsyncActionDialog(
        context: context,
        title: const Text('Editar material'),
        content: [
          TextField(
            controller: code,
            decoration: const InputDecoration(labelText: 'Código global'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Nome'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: unit,
            decoration: const InputDecoration(labelText: 'Unidade'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: category,
            decoration:
                const InputDecoration(labelText: 'Categoria (opcional)'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: description,
            decoration:
                const InputDecoration(labelText: 'Descrição (opcional)'),
          ),
        ],
        actionLabel: 'Salvar',
        validate: () =>
            requiredText(code.text, 'Código') ??
            requiredText(name.text, 'Nome'),
        onAction: () => repo.updateMaterialItem(
          itemId: material['id'].toString(),
          code: code.text,
          name: name.text,
          unit: unit.text,
          category: category.text,
          description: description.text,
        ),
        errorText: friendlyError,
        scrollContent: true,
        showBusyIndicator: true,
      );
    } finally {
      code.dispose();
      name.dispose();
      unit.dispose();
      category.dispose();
      description.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<Map<String, dynamic>?> showSearchableMaterialPicker(
    BuildContext context, List<Map<String, dynamic>> catalog) async {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _MaterialPickerSheet(catalog: catalog),
  );
}

class _MaterialPickerSheet extends StatefulWidget {
  const _MaterialPickerSheet({required this.catalog});
  final List<Map<String, dynamic>> catalog;
  @override
  State<_MaterialPickerSheet> createState() => _MaterialPickerSheetState();
}

class _MaterialPickerSheetState extends State<_MaterialPickerSheet> {
  String q = '';
  @override
  Widget build(BuildContext context) {
    final rows = widget.catalog.where((m) {
      final t = '${m['code']} ${m['name']} ${m['unit']}'.toLowerCase();
      return q.trim().isEmpty || t.contains(q.trim().toLowerCase());
    }).toList();
    return SafeArea(
        child: Padding(
            padding: EdgeInsets.fromLTRB(
                16, 4, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
            child: SizedBox(
                height: MediaQuery.sizeOf(context).height * .65,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Escolher material',
                          style: TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w900)),
                      const SizedBox(height: 12),
                      TextField(
                          autofocus: true,
                          onChanged: (v) => setState(() => q = v),
                          decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.search),
                              hintText: 'Pesquisar por nome ou código…')),
                      const SizedBox(height: 10),
                      Expanded(
                          child: rows.isEmpty
                              ? const Center(
                                  child: Text('Nenhum material encontrado.'))
                              : ListView.separated(
                                  itemCount: rows.length,
                                  separatorBuilder: (_, __) =>
                                      const Divider(height: 1),
                                  itemBuilder: (_, i) {
                                    final m = rows[i];
                                    return ListTile(
                                        title: Text(
                                            '${m['code']} • ${m['name']}',
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800)),
                                        subtitle: Text(
                                            'Unidade: ${m['unit'] ?? 'un'}'),
                                        onTap: () => Navigator.pop(context, m));
                                  }))
                    ]))));
  }
}

Future<void> showMaterialDialog(
  BuildContext context,
  CatalogRepository repo,
  List<Team> teams,
  String? initialTeamId,
) async {
  final actionLock = UiActionLock.acquire(context, 'showMaterialDialog');
  if (actionLock == null) return;
  try {
    final catalog = await repo.fetchMaterialCatalog();
    if (!context.mounted) return;

    final code = TextEditingController();
    final name = TextEditingController();
    final quantity = TextEditingController(text: '1');
    final unit = TextEditingController(text: 'un');
    String? teamId =
        initialTeamId ?? (teams.isNotEmpty ? teams.first.id : null);
    bool existing = catalog.isNotEmpty;
    String? selectedId;
    bool busy = false;
    String? error;

    try {
      await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Entrada de material'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (catalog.isNotEmpty) ...[
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: true, label: Text('Existente')),
                        ButtonSegment(value: false, label: Text('Novo')),
                      ],
                      selected: {existing},
                      onSelectionChanged: busy
                          ? null
                          : (v) => setLocal(() {
                                existing = v.first;
                                selectedId = null;
                                code.clear();
                                name.clear();
                                unit.text = 'un';
                              }),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (existing && catalog.isNotEmpty)
                    InkWell(
                      onTap: busy
                          ? null
                          : () async {
                              final selected =
                                  await showSearchableMaterialPicker(
                                      context, catalog);
                              if (selected == null) return;
                              setLocal(() {
                                selectedId = selected['id'].toString();
                                code.text = selected['code']?.toString() ?? '';
                                name.text = selected['name']?.toString() ?? '';
                                unit.text =
                                    selected['unit']?.toString() ?? 'un';
                              });
                            },
                      child: InputDecorator(
                        decoration: const InputDecoration(
                            labelText: 'Material cadastrado',
                            prefixIcon: Icon(Icons.search)),
                        child: Row(children: [
                          Expanded(
                              child: Text(
                                  selectedId == null
                                      ? 'Pesquisar por nome ou código…'
                                      : '${code.text} • ${name.text}',
                                  overflow: TextOverflow.ellipsis)),
                          const Icon(Icons.arrow_drop_down)
                        ]),
                      ),
                    )
                  else ...[
                    TextField(
                      controller: code,
                      decoration: const InputDecoration(labelText: 'Código'),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: name,
                      decoration: const InputDecoration(labelText: 'Material'),
                    ),
                  ],
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: teamId,
                    decoration: const InputDecoration(labelText: 'Equipe'),
                    items: teams
                        .map((t) =>
                            DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged: busy ? null : (v) => setLocal(() => teamId = v),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: quantity,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Quantidade'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: unit,
                          enabled: !(existing && catalog.isNotEmpty),
                          decoration:
                              const InputDecoration(labelText: 'Unidade'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Um material possui um único código. Cada equipe mantém apenas sua própria quantidade.',
                    style: TextStyle(fontSize: 12, color: Colors.white60),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        final q = int.tryParse(quantity.text.trim());
                        final validation = (existing &&
                                catalog.isNotEmpty &&
                                selectedId == null)
                            ? 'Selecione um material.'
                            : requiredText(code.text, 'Código') ??
                                requiredText(name.text, 'Material') ??
                                (teamId == null
                                    ? 'Selecione uma equipe.'
                                    : null) ??
                                positiveQuantity(q);
                        if (validation != null) {
                          setLocal(() => error = validation);
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.createMaterial(
                            code: code.text,
                            name: name.text,
                            teamId: teamId!,
                            quantity: q!,
                            unit: unit.text,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          setLocal(() => error = friendlyError(e));
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                child: busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Adicionar'),
              ),
            ],
          ),
        ),
      );
    } finally {
      code.dispose();
      name.dispose();
      quantity.dispose();
      unit.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showMaterialDistributionSheet(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  List<MaterialStock> stocks,
  String role,
  String? userTeamId,
) async {
  final sorted = [...stocks]..sort((a, b) =>
      (findTeam(teams, a.teamId)?.name ?? '')
          .compareTo(findTeam(teams, b.teamId)?.name ?? ''));
  final selectedStock = await showModalBottomSheet<MaterialStock>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * .76),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(stocks.first.name,
                        style: const TextStyle(
                            fontSize: 21, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text(
                        'Distribuição por equipe/local • ${stocks.fold<int>(0, (sum, item) => sum + item.quantity)} ${stocks.first.unit} no total',
                        style: const TextStyle(color: Colors.white60)),
                  ]),
            ),
            const Divider(height: 1),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: sorted.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 20, endIndent: 20),
                itemBuilder: (rowContext, index) {
                  final stock = sorted[index];
                  final allowed = role == 'admin' ||
                      role == 'engineer' ||
                      stock.teamId == userTeamId;
                  return ListTile(
                    leading: Icon(
                        findTeam(teams, stock.teamId)?.isCentral == true
                            ? Icons.warehouse_outlined
                            : Icons.groups_2_outlined),
                    title: Text(findTeam(teams, stock.teamId)?.name ?? 'Local'),
                    subtitle: Text(allowed
                        ? 'Toque para registrar movimentação'
                        : 'Somente consulta'),
                    trailing: Text('${stock.quantity} ${stock.unit}',
                        style: const TextStyle(
                            color: metalloAccent, fontWeight: FontWeight.w900)),
                    onTap: allowed
                        ? () => Navigator.pop(sheetContext, stock)
                        : null,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    ),
  );
  if (selectedStock != null && context.mounted) {
    await showMaterialActionsDialog(
        context, repo, teams, selectedStock, role, userTeamId);
  }
}

Future<void> showMaterialActionsDialog(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  MaterialStock material,
  String role,
  String? userTeamId,
) async {
  final current = findTeam(teams, material.teamId);
  final centralMatches = teams.where((t) => t.isCentral).toList();
  final central = centralMatches.isEmpty ? null : centralMatches.first;
  final canConsume =
      role == 'admin' || role == 'engineer' || material.teamId == userTeamId;
  final canReplenish = (role == 'admin' || role == 'engineer') &&
      current?.isCentral == true &&
      central != null;

  final action = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            title: Text(material.name),
            subtitle: Text(
                '${current?.name ?? 'Local'} • ${material.quantity} ${material.unit}'),
          ),
          if (canConsume)
            ListTile(
              leading:
                  const Icon(Icons.remove_circle_outline, color: metalloAccent),
              title: const Text('Registrar consumo'),
              subtitle: const Text('Baixa o material desta localização.'),
              onTap: () => Navigator.pop(sheetContext, 'consume'),
            ),
          if (canReplenish)
            ListTile(
              leading: const Icon(Icons.local_shipping_outlined,
                  color: metalloAccent),
              title: const Text('Repor equipe'),
              subtitle: const Text('Move estoque da COSEM para uma equipe.'),
              onTap: () => Navigator.pop(sheetContext, 'replenish'),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (!context.mounted || action == null) return;

  if (action == 'consume') {
    await showMaterialQuantityDialog(
      context,
      title: 'Consumo de ${material.name}',
      maximum: material.quantity,
      actionLabel: 'Registrar consumo',
      onConfirm: (quantity, note, _) => repo.consumeMaterial(
        itemId: material.itemId,
        teamId: material.teamId,
        quantity: quantity,
        note: note,
      ),
    );
  } else if (action == 'replenish' && central != null) {
    final destinations = teams.where((t) => !t.isCentral).toList();
    if (destinations.isEmpty) return;
    await showMaterialQuantityDialog(
      context,
      title: 'Reposição de ${material.name}',
      maximum: material.quantity,
      actionLabel: 'Repor equipe',
      destinations: destinations,
      onConfirm: (quantity, note, destinationTeamId) => repo.replenishMaterial(
        itemId: material.itemId,
        centralTeamId: central.id,
        destinationTeamId: destinationTeamId!,
        quantity: quantity,
        note: note,
      ),
    );
  }
}

Future<void> showMaterialQuantityDialog(
  BuildContext context, {
  required String title,
  required int maximum,
  required String actionLabel,
  List<Team>? destinations,
  required Future<void> Function(
          int quantity, String? note, String? destinationTeamId)
      onConfirm,
}) async {
  final actionLock =
      UiActionLock.acquire(context, 'showMaterialQuantityDialog');
  if (actionLock == null) return;
  try {
    final qty = TextEditingController(text: '1');
    final note = TextEditingController();
    String? destinationTeamId =
        (destinations != null && destinations.isNotEmpty)
            ? destinations.first.id
            : null;
    bool busy = false;
    String? error;

    try {
      await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: Text(title),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (destinations != null && destinations.isNotEmpty) ...[
                    DropdownButtonFormField<String>(
                      initialValue: destinationTeamId,
                      decoration:
                          const InputDecoration(labelText: 'Equipe de destino'),
                      items: destinations
                          .map((t) => DropdownMenuItem(
                              value: t.id, child: Text(t.name)))
                          .toList(),
                      onChanged: busy
                          ? null
                          : (v) => setLocal(() => destinationTeamId = v),
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(
                    controller: qty,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                        labelText: 'Quantidade (máx. $maximum)'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: note,
                    decoration: const InputDecoration(
                        labelText: 'Observação (opcional)'),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        final quantity = int.tryParse(qty.text);
                        if (quantity == null ||
                            quantity <= 0 ||
                            quantity > maximum) {
                          setLocal(() => error = 'Quantidade inválida.');
                          return;
                        }
                        if (destinations != null && destinationTeamId == null) {
                          setLocal(
                              () => error = 'Selecione a equipe de destino.');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await onConfirm(
                              quantity, note.text, destinationTeamId);
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          setLocal(() => error = friendlyError(e));
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                child: Text(actionLabel),
              ),
            ],
          ),
        ),
      );
    } finally {
      qty.dispose();
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}
