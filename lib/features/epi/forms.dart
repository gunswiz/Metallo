import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/shared/widgets/async_action_dialog.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';

Future<bool> showEmployeeForm(
    BuildContext context, EpiRepository repo, List<Team> teams,
    {Map<String, dynamic>? existing}) async {
  final actionLock = UiActionLock.acquire(context, 'showEmployeeForm');
  if (actionLock == null) return false;
  try {
    final form = GlobalKey<FormState>();
    final name =
        TextEditingController(text: existing?['full_name']?.toString() ?? '');
    final profession = TextEditingController(
        text: existing?['profession']?.toString() ?? 'Soldador');
    final registration = TextEditingController(
        text: existing?['registration_code']?.toString() ?? '');
    final shirt =
        TextEditingController(text: existing?['shirt_size']?.toString() ?? 'M');
    final shoe =
        TextEditingController(text: existing?['shoe_size']?.toString() ?? '');
    try {
      String? teamId = existing?['team_id']?.toString() ??
          teams.where((t) => !t.isCentral).firstOrNull?.id ??
          teams.firstOrNull?.id;
      bool busy = false;
      String? error;
      final result = await showLifecycleDialog<bool>(
          context: context,
          builder: (dialogContext) => StatefulBuilder(
              builder: (context, setLocal) => AlertDialog(
                    title: Text(existing == null
                        ? 'Novo funcionário'
                        : 'Editar funcionário'),
                    content: Form(
                        key: form,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              TextFormField(
                                  controller: name,
                                  decoration: const InputDecoration(
                                      labelText: 'Nome completo'),
                                  validator: (v) => (v?.trim().length ?? 0) < 3
                                      ? 'Informe o nome.'
                                      : null),
                              const SizedBox(height: 10),
                              DropdownButtonFormField<String>(
                                  initialValue: profession.text,
                                  decoration: const InputDecoration(
                                      labelText: 'Função'),
                                  items: const [
                                    'Soldador',
                                    'Ajudante',
                                    'Montador',
                                    'Pintor',
                                    'Encarregado',
                                    'Operador de Munck'
                                  ]
                                      .map((v) => DropdownMenuItem(
                                          value: v, child: Text(v)))
                                      .toList(),
                                  onChanged: (v) =>
                                      profession.text = v ?? 'Soldador'),
                              const SizedBox(height: 10),
                              DropdownButtonFormField<String>(
                                  initialValue: teamId,
                                  decoration: const InputDecoration(
                                      labelText: 'Equipe'),
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
                                        items: const [
                                          'M',
                                          'G',
                                          'GG',
                                          'XG',
                                          'XXG'
                                        ]
                                            .map((v) => DropdownMenuItem(
                                                value: v, child: Text(v)))
                                            .toList(),
                                        onChanged: (v) =>
                                            shirt.text = v ?? 'M')),
                                const SizedBox(width: 8),
                                Expanded(
                                    child: TextFormField(
                                        controller: shoe,
                                        keyboardType: TextInputType.number,
                                        decoration: const InputDecoration(
                                            labelText: 'Calçado',
                                            hintText: '38 a 46'),
                                        validator: (value) {
                                          final size =
                                              int.tryParse(value?.trim() ?? '');
                                          if (size == null ||
                                              size < 38 ||
                                              size > 46) {
                                            return 'Use 38 a 46.';
                                          }
                                          return null;
                                        }))
                              ]),
                              if (error != null)
                                Padding(
                                    padding: const EdgeInsets.only(top: 10),
                                    child: Text(error!,
                                        style: const TextStyle(
                                            color: Colors.redAccent))),
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
                                  if (busy) return;
                                  if (!(form.currentState?.validate() ??
                                      false)) {
                                    return;
                                  }
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
                                    if (dialogContext.mounted) {
                                      Navigator.pop(dialogContext, true);
                                    }
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
      return result ?? false;
    } finally {
      name.dispose();
      profession.dispose();
      registration.dispose();
      shirt.dispose();
      shoe.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showEmployeeActions(
    BuildContext context,
    EpiRepository repo,
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
    if (await showEmployeeForm(context, repo, teams, existing: person) &&
        context.mounted) {
      onChanged();
      showEpiMessage(context, 'Funcionário atualizado.');
    }
  } else if (action == 'items') {
    if (await _employeeItemsForm(context, repo, person) && context.mounted) {
      onChanged();
      showEpiMessage(context, 'Itens previstos atualizados.');
    }
  }
}

Future<bool> _employeeItemsForm(BuildContext context, EpiRepository repo,
    Map<String, dynamic> person) async {
  final actionLock = UiActionLock.acquire(context, '_employeeItemsForm');
  if (actionLock == null) return false;
  try {
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
      if (context.mounted) {
        showEpiMessage(context, 'Não foi possível carregar os itens.');
      }
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
        for (final rec in recommendedEpiCodes(
            person['profession']?.toString() ?? '', kind)) {
          final item = items.where((i) => i['code'] == rec.$1).firstOrNull;
          if (item != null) selected[item['id'].toString()] = rec.$2;
        }
      }
    }
    String kind = 'epi';
    String query = '';
    bool busy = false;
    String? error;
    final result = await showLifecycleDialog<bool>(
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
                                value: 'personal_tool',
                                label: Text('Pessoais')),
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
                                  if ((selected[id] ?? 1) > 1) {
                                    selected[id] = selected[id]! - 1;
                                  }
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
                              if (busy) return;
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
  } finally {
    actionLock.release();
  }
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
        color: selected ? epiBlue.withValues(alpha: .08) : Colors.transparent,
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

Future<bool> showItemForm(BuildContext context, EpiRepository repo,
    {Map<String, dynamic>? existing}) async {
  final actionLock = UiActionLock.acquire(context, 'showItemForm');
  if (actionLock == null) return false;
  try {
    final form = GlobalKey<FormState>();
    final code =
        TextEditingController(text: existing?['code']?.toString() ?? '');
    final name =
        TextEditingController(text: existing?['name']?.toString() ?? '');
    final unit =
        TextEditingController(text: existing?['unit']?.toString() ?? 'un');
    final ca =
        TextEditingController(text: existing?['ca_number']?.toString() ?? '');
    final brand =
        TextEditingController(text: existing?['brand_model']?.toString() ?? '');
    final minimum = TextEditingController(
        text: existing?['minimum_stock']?.toString() ?? '0');
    try {
      String kind = existing?['item_kind']?.toString() ?? 'epi';
      bool busy = false;
      String? error;
      final result = await showLifecycleDialog<bool>(
          context: context,
          builder: (dialogContext) => StatefulBuilder(
              builder: (context, setLocal) => AlertDialog(
                    title: Text(
                        existing == null ? 'Cadastrar item' : 'Editar item'),
                    content: Form(
                        key: form,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              DropdownButtonFormField<String>(
                                  initialValue: kind,
                                  decoration:
                                      const InputDecoration(labelText: 'Tipo'),
                                  items: const [
                                    DropdownMenuItem(
                                        value: 'epi', child: Text('EPI')),
                                    DropdownMenuItem(
                                        value: 'uniform',
                                        child: Text('Fardamento')),
                                    DropdownMenuItem(
                                        value: 'personal_tool',
                                        child: Text('Item pessoal'))
                                  ],
                                  onChanged: (v) =>
                                      setLocal(() => kind = v ?? 'epi')),
                              const SizedBox(height: 10),
                              TextFormField(
                                  controller: code,
                                  decoration: const InputDecoration(
                                      labelText: 'Código'),
                                  validator: (v) => (v?.trim().isEmpty ?? true)
                                      ? 'Informe o código.'
                                      : null),
                              const SizedBox(height: 10),
                              TextFormField(
                                  controller: name,
                                  decoration:
                                      const InputDecoration(labelText: 'Nome'),
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
                                        style: const TextStyle(
                                            color: Colors.redAccent))),
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
                                  if (busy) return;
                                  if (!(form.currentState?.validate() ??
                                      false)) {
                                    return;
                                  }
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
                                    if (dialogContext.mounted) {
                                      Navigator.pop(dialogContext, true);
                                    }
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
      return result ?? false;
    } finally {
      code.dispose();
      name.dispose();
      unit.dispose();
      ca.dispose();
      brand.dispose();
      minimum.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showItemActions(BuildContext context, EpiRepository repo,
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
    if (await showItemForm(context, repo, existing: item) && context.mounted) {
      reload();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Item atualizado.')));
    }
  } else if (action == 'delete') {
    final confirmed = await showLifecycleDialog<bool>(
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

Future<bool> showStockForm(
    BuildContext context, EpiRepository repo, Map<String, dynamic> item) async {
  final actionLock = UiActionLock.acquire(context, 'showStockForm');
  if (actionLock == null) return false;
  try {
    final form = GlobalKey<FormState>();
    final quantity = TextEditingController();
    final ca = TextEditingController(text: item['ca_number']?.toString() ?? '');
    final brand =
        TextEditingController(text: item['brand_model']?.toString() ?? '');
    final lot = TextEditingController();
    try {
      String? variant;
      bool busy = false;
      String? error;
      final isEpi = item['item_kind'] == 'epi';
      final isBoot = isBootEpiItem(item);
      final isGlasses = isGlassesEpiItem(item);
      final result = await showLifecycleDialog<bool>(
          context: context,
          builder: (dialogContext) => StatefulBuilder(
              builder: (context, setLocal) => AlertDialog(
                    title: Text('Entrada: ${item['name']}'),
                    content: Form(
                        key: form,
                        child: SingleChildScrollView(
                            child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                              TextFormField(
                                  controller: quantity,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                      labelText: 'Quantidade recebida'),
                                  validator: (v) =>
                                      (int.tryParse(v ?? '') ?? 0) <= 0
                                          ? 'Informe uma quantidade válida.'
                                          : null),
                              if (isBoot || isGlasses)
                                const SizedBox(height: 10),
                              if (isBoot)
                                DropdownButtonFormField<String>(
                                  initialValue: variant,
                                  decoration: const InputDecoration(
                                      labelText: 'Número da botina'),
                                  items: [
                                    for (var size = 38; size <= 46; size++)
                                      DropdownMenuItem(
                                          value: '$size',
                                          child: Text('Número $size')),
                                  ],
                                  onChanged: (value) =>
                                      setLocal(() => variant = value),
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
                                  onChanged: (value) =>
                                      setLocal(() => variant = value),
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
                                    validator: (v) => (v?.trim().isEmpty ??
                                            true)
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
                                        style: const TextStyle(
                                            color: Colors.redAccent))),
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
                                  if (busy) return;
                                  if (!(form.currentState?.validate() ??
                                      false)) {
                                    return;
                                  }
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
                                    if (dialogContext.mounted) {
                                      Navigator.pop(dialogContext, true);
                                    }
                                  } catch (_) {
                                    setLocal(() {
                                      busy = false;
                                      error =
                                          'Não foi possível registrar a entrada.';
                                    });
                                  }
                                },
                          child:
                              Text(busy ? 'Salvando...' : 'Registrar entrada'))
                    ],
                  )));
      return result ?? false;
    } finally {
      quantity.dispose();
      ca.dispose();
      brand.dispose();
      lot.dispose();
    }
  } finally {
    actionLock.release();
  }
}
