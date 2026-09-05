import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/core/validation.dart';
import 'package:metallo/data/models/equipment_asset.dart';
import 'package:metallo/data/models/equipment_ownership.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/async_action_dialog.dart';
import 'package:metallo/shared/widgets/equipment_ownership_badge.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/features/equipment/grouping.dart';

Future<bool?> showEditEquipmentCatalogDialog(
  BuildContext context,
  CatalogRepository repo,
  List<Team> teams,
  Map<String, dynamic> equipment,
) async {
  final actionLock =
      UiActionLock.acquire(context, 'showEditEquipmentCatalogDialog');
  if (actionLock == null) return null;
  try {
    final assetCode =
        TextEditingController(text: equipment['asset_code']?.toString() ?? '');
    final serialNumber = TextEditingController(
        text: equipment['serial_number']?.toString() ?? '');
    final ownership = parseEquipmentOwnership(equipment['notes'] as String?);
    final notes = TextEditingController(text: ownership.notes ?? '');
    final rentalCompany =
        TextEditingController(text: ownership.rentalCompany ?? '');
    final rentalEndDate =
        TextEditingController(text: ownership.rentalEndDate ?? '');
    String ownershipType = ownership.type;
    String? teamId = equipment['team_id']?.toString();
    String status = equipment['status']?.toString() ?? 'available';
    const statuses = [
      'available',
      'in_use',
      'maintenance',
      'damaged',
      'lost',
      'retired'
    ];
    bool busy = false;
    String? error;
    final item = equipment['items'] as Map?;
    final typeName = TextEditingController(
        text: equipmentTypeDisplayName(item?['name']?.toString() ?? ''));

    try {
      return await showLifecycleDialog<bool>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Editar equipamento'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (item != null) ...[
                    TextField(
                        controller: typeName,
                        decoration: const InputDecoration(
                            labelText: 'Tipo do equipamento')),
                    const SizedBox(height: 6),
                    Text(
                        'Alterar este nome atualiza todos os patrimônios deste tipo.',
                        style: const TextStyle(
                            color: Colors.white60, fontSize: 12)),
                  ],
                  const SizedBox(height: 12),
                  TextField(
                      controller: assetCode,
                      decoration: const InputDecoration(
                          labelText: 'Código/patrimônio')),
                  const SizedBox(height: 10),
                  TextField(
                      controller: serialNumber,
                      decoration: const InputDecoration(
                          labelText: 'Número de série (opcional)')),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                      initialValue: ownershipType,
                      decoration:
                          const InputDecoration(labelText: 'Propriedade'),
                      items: const [
                        DropdownMenuItem(
                            value: 'owned', child: Text('Próprio da empresa')),
                        DropdownMenuItem(
                            value: 'rented', child: Text('Equipamento alugado'))
                      ],
                      onChanged: busy
                          ? null
                          : (v) =>
                              setLocal(() => ownershipType = v ?? 'owned')),
                  if (ownershipType == 'rented') ...[
                    const SizedBox(height: 10),
                    TextField(
                        controller: rentalCompany,
                        decoration: const InputDecoration(
                            labelText: 'Empresa locadora')),
                    const SizedBox(height: 10),
                    TextField(
                        controller: rentalEndDate,
                        decoration: const InputDecoration(
                            labelText: 'Fim da locação',
                            hintText: 'AAAA-MM-DD'))
                  ],
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue:
                        teams.any((t) => t.id == teamId) ? teamId : null,
                    decoration: const InputDecoration(
                        labelText: 'Equipe / localização'),
                    items: teams
                        .map((t) =>
                            DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged: busy ? null : (v) => setLocal(() => teamId = v),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue:
                        statuses.contains(status) ? status : 'available',
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: statuses
                        .map((s) => DropdownMenuItem(
                            value: s, child: Text(statusLabel(s))))
                        .toList(),
                    onChanged: busy
                        ? null
                        : (v) => setLocal(() => status = v ?? 'available'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notes,
                    maxLines: 3,
                    decoration: const InputDecoration(
                        labelText: 'Observações (opcional)'),
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
                onPressed:
                    busy ? null : () => Navigator.pop(dialogContext, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        final validation = item == null
                            ? 'Equipamento não encontrado.'
                            : requiredText(
                                    typeName.text, 'Tipo do equipamento') ??
                                requiredText(
                                    assetCode.text, 'Código/patrimônio');
                        if (validation != null) {
                          setLocal(() => error = validation);
                          return;
                        }
                        if (ownershipType == 'rented' &&
                            rentalCompany.text.trim().isEmpty) {
                          setLocal(() => error = 'Informe a empresa locadora.');
                          return;
                        }
                        if (teamId == null) {
                          setLocal(
                              () => error = 'Selecione a equipe/localização.');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          if (item == null) {
                            throw StateError('item_not_found');
                          }
                          await repo.updateEquipment(
                            itemId: item['id'].toString(),
                            itemCode: item['code']?.toString() ?? '',
                            itemName: typeName.text,
                            assetId: equipment['id'].toString(),
                            assetCode: assetCode.text,
                            serialNumber: serialNumber.text,
                            teamId: teamId!,
                            status: status,
                            notes: notes.text,
                            ownershipType: ownershipType,
                            rentalCompany: rentalCompany.text,
                            rentalEndDate: rentalEndDate.text,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, true);
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
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('Salvar'),
              ),
            ],
          ),
        ),
      );
    } finally {
      assetCode.dispose();
      serialNumber.dispose();
      notes.dispose();
      rentalCompany.dispose();
      rentalEndDate.dispose();
      typeName.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showEquipmentDialog(
  BuildContext context,
  CatalogRepository repo,
  List<Team> teams,
  String? initialTeamId,
) async {
  final actionLock = UiActionLock.acquire(context, 'showEquipmentDialog');
  if (actionLock == null) return;
  try {
    final code = TextEditingController();
    final name = TextEditingController();
    final assetCode = TextEditingController();
    final serial = TextEditingController();
    final rentalCompany = TextEditingController();
    final rentalEndDate = TextEditingController();
    final notes = TextEditingController();
    String? suggestedType;
    String ownershipType = 'owned';
    String? teamId =
        initialTeamId ?? (teams.isNotEmpty ? teams.first.id : null);
    bool busy = false;
    String? error;

    try {
      await showLifecycleDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Novo equipamento'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                      controller: code,
                      decoration:
                          const InputDecoration(labelText: 'Código do tipo')),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: suggestedType,
                    decoration: const InputDecoration(
                        labelText: 'Tipo comum (opcional)'),
                    items: const [
                      DropdownMenuItem(
                          value: 'Máquina de solda trifásica',
                          child: Text('Máquina de solda trifásica')),
                      DropdownMenuItem(
                          value: 'Máquina de solda MIG',
                          child: Text('Máquina de solda MIG')),
                      DropdownMenuItem(
                          value: 'Máquina de solda inversora',
                          child: Text('Máquina de solda inversora')),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setLocal(() {
                              suggestedType = value;
                              if (value != null) name.text = value;
                            }),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                      controller: name,
                      decoration: const InputDecoration(
                          labelText: 'Equipamento / tipo')),
                  const SizedBox(height: 10),
                  TextField(
                    controller: assetCode,
                    decoration: const InputDecoration(
                        labelText: 'Patrimônio / identificação'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: serial,
                    decoration: const InputDecoration(
                        labelText: 'Número de série (opcional)'),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                      initialValue: ownershipType,
                      decoration:
                          const InputDecoration(labelText: 'Propriedade'),
                      items: const [
                        DropdownMenuItem(
                            value: 'owned', child: Text('Próprio da empresa')),
                        DropdownMenuItem(
                            value: 'rented', child: Text('Equipamento alugado'))
                      ],
                      onChanged: busy
                          ? null
                          : (v) =>
                              setLocal(() => ownershipType = v ?? 'owned')),
                  if (ownershipType == 'rented') ...[
                    const SizedBox(height: 10),
                    TextField(
                        controller: rentalCompany,
                        decoration: const InputDecoration(
                            labelText: 'Empresa locadora')),
                    const SizedBox(height: 10),
                    TextField(
                        controller: rentalEndDate,
                        decoration: const InputDecoration(
                            labelText: 'Fim da locação',
                            hintText: 'AAAA-MM-DD'))
                  ],
                  const SizedBox(height: 10),
                  TextField(
                      controller: notes,
                      maxLines: 2,
                      decoration: const InputDecoration(
                          labelText: 'Observações (opcional)')),
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
                  const SizedBox(height: 8),
                  const Text(
                    'O código identifica o tipo/modelo; o patrimônio identifica o equipamento físico.',
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
                        final validation = requiredText(code.text, 'Código') ??
                            requiredText(name.text, 'Equipamento') ??
                            requiredText(assetCode.text, 'Patrimônio') ??
                            (ownershipType == 'rented' &&
                                    rentalCompany.text.trim().isEmpty
                                ? 'Informe a empresa locadora.'
                                : null) ??
                            (teamId == null ? 'Selecione a equipe.' : null);
                        if (validation != null) {
                          setLocal(() => error = validation);
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.createEquipment(
                            code: code.text,
                            name: name.text,
                            assetCode: assetCode.text,
                            serialNumber: serial.text,
                            teamId: teamId!,
                            ownershipType: ownershipType,
                            rentalCompany: rentalCompany.text,
                            rentalEndDate: rentalEndDate.text,
                            notes: notes.text,
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
                    : const Text('Criar'),
              ),
            ],
          ),
        ),
      );
    } finally {
      code.dispose();
      name.dispose();
      assetCode.dispose();
      serial.dispose();
      rentalCompany.dispose();
      rentalEndDate.dispose();
      notes.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showEquipmentFamilySheet(
  BuildContext context,
  CatalogRepository catalogRepository,
  MovementRepository movementRepository,
  List<Team> teams,
  List<EquipmentAsset> assets, {
  required String role,
  required String? userTeamId,
  required bool canOperate,
}) async {
  final pageContext = context;
  final types = <String, List<EquipmentAsset>>{};
  for (final asset in assets) {
    types.putIfAbsent(asset.itemId, () => <EquipmentAsset>[]).add(asset);
  }
  final sortedTypes = types.values.toList()
    ..sort((a, b) =>
        a.first.name.toLowerCase().compareTo(b.first.name.toLowerCase()));
  await showModalBottomSheet<void>(
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
                    Text(equipmentFamilyLabel(assets),
                        style: const TextStyle(
                            fontSize: 21, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text(
                        '${types.length} ${types.length == 1 ? 'tipo cadastrado' : 'tipos cadastrados'} • ${assets.length} ${assets.length == 1 ? 'equipamento' : 'equipamentos'}',
                        style: const TextStyle(color: Colors.white60)),
                  ]),
            ),
            const Divider(height: 1),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                padding: const EdgeInsets.symmetric(vertical: 8),
                itemCount: sortedTypes.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 20, endIndent: 20),
                itemBuilder: (context, index) {
                  final typeAssets = sortedTypes[index];
                  return ListTile(
                    leading: const Icon(Icons.category_outlined,
                        color: metalloAccent),
                    title: Text(typeAssets.first.name),
                    subtitle: Text(
                        '${typeAssets.length} ${typeAssets.length == 1 ? 'patrimônio' : 'patrimônios'} • ${typeAssets.map((e) => e.teamId).toSet().length} ${typeAssets.map((e) => e.teamId).toSet().length == 1 ? 'local' : 'locais'}'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () async {
                      Navigator.pop(sheetContext);
                      await Future<void>.delayed(
                          const Duration(milliseconds: 250));
                      if (!pageContext.mounted) return;
                      await showEquipmentGroupSheet(
                        pageContext,
                        catalogRepository,
                        movementRepository,
                        teams,
                        typeAssets,
                        role: role,
                        userTeamId: userTeamId,
                        canOperate: canOperate,
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

Future<void> showEquipmentGroupSheet(
  BuildContext context,
  CatalogRepository catalogRepository,
  MovementRepository movementRepository,
  List<Team> teams,
  List<EquipmentAsset> assets, {
  required String role,
  required String? userTeamId,
  required bool canOperate,
}) async {
  final pageContext = context;
  final sorted = [...assets]..sort((a, b) {
      final teamOrder = (findTeam(teams, a.teamId)?.name ?? '')
          .compareTo(findTeam(teams, b.teamId)?.name ?? '');
      return teamOrder != 0 ? teamOrder : a.assetCode.compareTo(b.assetCode);
    });
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * .78),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 12),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(assets.first.name,
                        style: const TextStyle(
                            fontSize: 21, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text(
                        '${assets.length} ${assets.length == 1 ? 'patrimônio cadastrado' : 'patrimônios cadastrados'}',
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
                itemBuilder: (context, index) {
                  final asset = sorted[index];
                  final allowed = canOperate &&
                      (role == 'admin' ||
                          role == 'engineer' ||
                          asset.teamId == userTeamId);
                  return ListTile(
                    leading: Container(
                      constraints: const BoxConstraints(minWidth: 76),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 9, vertical: 7),
                      decoration: BoxDecoration(
                          color: const Color(0xFF263240),
                          borderRadius: BorderRadius.circular(9)),
                      child: Text(asset.assetCode,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.w900)),
                    ),
                    title: Row(children: [
                      Expanded(
                          child: Text(
                              findTeam(teams, asset.teamId)?.name ?? 'Equipe')),
                      EquipmentOwnershipBadge(type: asset.ownershipType)
                    ]),
                    subtitle: Text(asset.ownershipType == 'rented' &&
                            asset.rentalCompany?.isNotEmpty == true
                        ? '${asset.rentalCompany} • ${statusLabel(asset.status)}'
                        : statusLabel(asset.status)),
                    trailing: allowed ? const Icon(Icons.more_vert) : null,
                    onTap: allowed
                        ? () async {
                            Navigator.pop(sheetContext);
                            await Future<void>.delayed(
                                const Duration(milliseconds: 250));
                            if (!pageContext.mounted) return;
                            await showEquipmentActionsSheet(
                                pageContext,
                                catalogRepository,
                                movementRepository,
                                teams,
                                asset,
                                role: role,
                                userTeamId: userTeamId);
                          }
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
}

Future<void> showEquipmentActionsSheet(
  BuildContext context,
  CatalogRepository catalogRepository,
  MovementRepository movementRepository,
  List<Team> teams,
  EquipmentAsset equipment, {
  required String role,
  required String? userTeamId,
}) async {
  final pageContext = context;
  final isMaintenance = equipment.status == 'maintenance';
  final actionLock = UiActionLock.acquire(context, 'equipment-actions');
  if (actionLock == null) return;
  bool actionChosen = false;
  try {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(equipment.name,
                  style: const TextStyle(
                      fontSize: 21, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text('Patrimônio ${equipment.assetCode}',
                  style: const TextStyle(color: Colors.white60)),
              const SizedBox(height: 14),
              if (!isMaintenance)
                ListTile(
                  leading: const Icon(Icons.swap_horiz_rounded),
                  title: const Text('Transferir equipamento'),
                  subtitle: const Text(
                      'Mover o patrimônio para outra equipe ou local'),
                  onTap: () async {
                    if (actionChosen) return;
                    actionChosen = true;
                    Navigator.pop(sheetContext);
                    await Future<void>.delayed(
                        const Duration(milliseconds: 250));
                    if (!pageContext.mounted) return;
                    await showEquipmentTransferDialog(
                        pageContext, movementRepository, teams, equipment);
                  },
                ),
              if (equipment.ownershipType == 'rented' && role == 'admin')
                ListTile(
                  leading: const Icon(Icons.assignment_return_outlined,
                      color: metalloWarning),
                  title: const Text('Devolver à locadora'),
                  subtitle: const Text(
                      'Devolver somente este patrimônio e manter os demais na equipe'),
                  onTap: () async {
                    if (actionChosen) return;
                    actionChosen = true;
                    Navigator.pop(sheetContext);
                    await Future<void>.delayed(
                        const Duration(milliseconds: 250));
                    if (!pageContext.mounted) return;
                    await showRentalReturnDialog(
                        pageContext, movementRepository, equipment);
                  },
                ),
              if (equipment.ownershipType == 'rented' && role == 'admin')
                ListTile(
                  leading: const Icon(Icons.change_circle_outlined,
                      color: metalloEquipmentWarning),
                  title: const Text('Substituir equipamento alugado'),
                  subtitle: const Text(
                      'Trocar o patrimônio recebido sem criar outro cadastro'),
                  onTap: () async {
                    if (actionChosen) return;
                    actionChosen = true;
                    Navigator.pop(sheetContext);
                    await Future<void>.delayed(
                        const Duration(milliseconds: 250));
                    if (!pageContext.mounted) return;
                    await showRentedEquipmentReplacementDialog(
                        pageContext, catalogRepository, equipment);
                  },
                ),
              if (!isMaintenance && equipment.ownershipType != 'rented')
                ListTile(
                  leading: const Icon(Icons.build_rounded,
                      color: metalloEquipmentWarning),
                  title: const Text('Enviar para manutenção'),
                  subtitle: const Text(
                      'Mantém o patrimônio rastreado e altera o status para Em manutenção'),
                  onTap: () async {
                    if (actionChosen) return;
                    actionChosen = true;
                    Navigator.pop(sheetContext);
                    await Future<void>.delayed(
                        const Duration(milliseconds: 250));
                    if (!pageContext.mounted) return;
                    await showEquipmentMaintenanceDialog(
                        pageContext, movementRepository, equipment);
                  },
                ),
              if (isMaintenance && equipment.ownershipType != 'rented')
                ListTile(
                  leading: const Icon(Icons.keyboard_return_rounded,
                      color: metalloAccent),
                  title: const Text('Retornar da manutenção'),
                  subtitle: const Text(
                      'Escolha a equipe/local de retorno e disponibilize o equipamento novamente'),
                  onTap: () async {
                    if (actionChosen) return;
                    actionChosen = true;
                    Navigator.pop(sheetContext);
                    final destinations = role == 'leader'
                        ? teams.where((t) => t.id == userTeamId).toList()
                        : teams;
                    await Future<void>.delayed(
                        const Duration(milliseconds: 250));
                    if (!pageContext.mounted) return;
                    await showEquipmentMaintenanceReturnDialog(pageContext,
                        movementRepository, destinations, equipment);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}

Future<void> showRentalReturnDialog(BuildContext context,
    MovementRepository repo, EquipmentAsset equipment) async {
  final actionLock = UiActionLock.acquire(context, 'showRentalReturnDialog');
  if (actionLock == null) return;
  try {
    final note = TextEditingController();
    var busy = false;
    String? error;
    try {
      await showLifecycleDialog<void>(
          context: context,
          builder: (dialogContext) => StatefulBuilder(
              builder: (context, setLocal) => AlertDialog(
                    title: const Text('Devolver equipamento alugado'),
                    content: SingleChildScrollView(
                        child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text('${equipment.name} • ${equipment.assetCode}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 10),
                          const Text(
                              'Será devolvida 1 unidade: este patrimônio. Os outros equipamentos da equipe não serão alterados. O cadastro será arquivado, preservando os registros.'),
                          const SizedBox(height: 12),
                          TextField(
                              controller: note,
                              decoration: const InputDecoration(
                                  labelText: 'Observação da devolução')),
                          if (error != null)
                            Text(error!,
                                style:
                                    const TextStyle(color: Colors.redAccent)),
                        ])),
                    actions: [
                      TextButton(
                          onPressed:
                              busy ? null : () => Navigator.pop(dialogContext),
                          child: const Text('Cancelar')),
                      FilledButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  if (busy) return;
                                  setLocal(() {
                                    busy = true;
                                    error = null;
                                  });
                                  try {
                                    await repo.returnRentedEquipment(
                                        equipment, note.text);
                                    if (dialogContext.mounted) {
                                      Navigator.pop(dialogContext);
                                    }
                                  } catch (e) {
                                    if (dialogContext.mounted) {
                                      setLocal(() {
                                        busy = false;
                                        error = friendlyError(e);
                                      });
                                    }
                                  }
                                },
                          child: Text(
                              busy ? 'Devolvendo...' : 'Confirmar devolução')),
                    ],
                  )));
    } finally {
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showEquipmentMaintenanceDialog(
  BuildContext context,
  MovementRepository repo,
  EquipmentAsset equipment,
) async {
  final actionLock =
      UiActionLock.acquire(context, 'showEquipmentMaintenanceDialog');
  if (actionLock == null) return;
  try {
    final note = TextEditingController();
    try {
      await showAsyncActionDialog(
        context: context,
        title: const Text('Enviar para manutenção'),
        contentCrossAxisAlignment: CrossAxisAlignment.start,
        content: [
          Text('${equipment.name} • ${equipment.assetCode}',
              style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text(
              'O patrimônio continuará vinculado à equipe atual, mas ficará indisponível até o retorno da manutenção.',
              style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 12),
          TextField(
            controller: note,
            maxLines: 3,
            decoration: const InputDecoration(
                labelText: 'Motivo / observação',
                hintText: 'Ex.: troca de rolamento, revisão elétrica...'),
          ),
        ],
        actionLabel: 'Enviar',
        actionIcon: Icons.build_rounded,
        onAction: () => repo.sendEquipmentToMaintenance(
            assetId: equipment.id, note: note.text),
        errorText: friendlyError,
      );
    } finally {
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showRentedEquipmentReplacementDialog(
  BuildContext context,
  CatalogRepository repo,
  EquipmentAsset equipment,
) async {
  final actionLock =
      UiActionLock.acquire(context, 'showRentedEquipmentReplacementDialog');
  if (actionLock == null) return;
  try {
    final assetCode = TextEditingController();
    final serialNumber = TextEditingController();
    final reason = TextEditingController();
    try {
      await showAsyncActionDialog(
        context: context,
        title: const Text('Substituir alugado'),
        contentCrossAxisAlignment: CrossAxisAlignment.start,
        content: [
          Text(
            '${equipment.name} • patrimônio atual ${equipment.assetCode}',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          const Text(
            'A máquina continua na mesma equipe. O patrimônio anterior ficará registrado nas observações para rastreabilidade.',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: assetCode,
            decoration: const InputDecoration(labelText: 'Novo patrimônio *'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: serialNumber,
            decoration: const InputDecoration(
                labelText: 'Novo número de série (opcional)'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: reason,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Motivo / observação',
              hintText: 'Ex.: troca realizada pela locadora',
            ),
          ),
        ],
        actionLabel: 'Confirmar troca',
        actionIcon: Icons.change_circle_outlined,
        validate: () {
          final validation = requiredText(assetCode.text, 'Novo patrimônio');
          if (validation != null) return validation;
          if (assetCode.text.trim().toLowerCase() ==
              equipment.assetCode.trim().toLowerCase()) {
            return 'Informe um patrimônio diferente do atual.';
          }
          return null;
        },
        onAction: () => repo.updateEquipmentAsset(
          assetId: equipment.id,
          assetCode: assetCode.text,
          serialNumber: serialNumber.text,
          teamId: equipment.teamId,
          status: 'available',
          notes: _rentedReplacementNotes(
            equipment,
            assetCode.text,
            reason.text,
            DateTime.now(),
          ),
          ownershipType: 'rented',
          rentalCompany: equipment.rentalCompany,
          rentalEndDate: equipment.rentalEndDate,
        ),
        errorText: friendlyError,
        scrollContent: true,
        showBusyIndicator: true,
        busyIndicatorSize: 18,
      );
    } finally {
      assetCode.dispose();
      serialNumber.dispose();
      reason.dispose();
    }
  } finally {
    actionLock.release();
  }
}

String _rentedReplacementNotes(
  EquipmentAsset equipment,
  String newAssetCode,
  String reason,
  DateTime replacementDate,
) {
  final date =
      '${replacementDate.day.toString().padLeft(2, '0')}/${replacementDate.month.toString().padLeft(2, '0')}/${replacementDate.year}';
  final detail = reason.trim().isEmpty ? '' : ' • ${reason.trim()}';
  final replacementLog =
      'Substituição em $date: patrimônio ${equipment.assetCode} → ${newAssetCode.trim()}$detail';
  return [equipment.notes?.trim(), replacementLog]
      .whereType<String>()
      .where((value) => value.isNotEmpty)
      .join('\n');
}

Future<void> showEquipmentMaintenanceReturnDialog(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  EquipmentAsset equipment,
) async {
  final actionLock =
      UiActionLock.acquire(context, 'showEquipmentMaintenanceReturnDialog');
  if (actionLock == null) return;
  try {
    if (teams.isEmpty) {
      showError(
          context,
          Exception(
              'Nenhuma equipe/local disponível para receber o equipamento.'));
      return;
    }
    String to = teams.any((t) => t.id == equipment.teamId)
        ? equipment.teamId
        : teams.first.id;
    final note = TextEditingController();
    bool busy = false;
    String? error;
    try {
      await showLifecycleDialog<void>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Retornar da manutenção'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: to,
                  decoration: const InputDecoration(
                      labelText: 'Equipe/local de retorno'),
                  items: teams
                      .map((t) =>
                          DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => to = v!),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: note,
                  maxLines: 3,
                  decoration: const InputDecoration(
                      labelText: 'Observação do retorno',
                      hintText:
                          'Ex.: manutenção concluída, equipamento revisado...'),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error)),
                ],
              ],
            ),
            actions: [
              TextButton(
                  onPressed: busy ? null : () => Navigator.pop(dialogContext),
                  child: const Text('Cancelar')),
              FilledButton.icon(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.returnEquipmentFromMaintenance(
                              assetId: equipment.id,
                              toTeamId: to,
                              note: note.text);
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          if (dialogContext.mounted) {
                            setLocal(() => error = friendlyError(e));
                          }
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                icon: const Icon(Icons.keyboard_return_rounded),
                label: const Text('Retornar'),
              ),
            ],
          ),
        ),
      );
    } finally {
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showEquipmentTransferDialog(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  EquipmentAsset equipment,
) async {
  final actionLock =
      UiActionLock.acquire(context, 'showEquipmentTransferDialog');
  if (actionLock == null) return;
  try {
    final destinations = teams.where((t) => t.id != equipment.teamId).toList();
    if (destinations.isEmpty) return;
    String to = destinations.first.id;
    bool busy = false;
    String? error;

    await showLifecycleDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: Text('Transferir ${equipment.name}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: to,
                decoration:
                    const InputDecoration(labelText: 'Equipe de destino'),
                items: destinations
                    .map((t) =>
                        DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setLocal(() => to = v!),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
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
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await repo.transferEquipment(
                            assetId: equipment.id, toTeamId: to);
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        setLocal(() => error = friendlyError(e));
                      } finally {
                        if (dialogContext.mounted) setLocal(() => busy = false);
                      }
                    },
              child: const Text('Transferir'),
            ),
          ],
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}
