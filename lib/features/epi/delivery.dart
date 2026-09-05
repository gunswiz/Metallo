import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';
import 'package:metallo/features/epi/epi_view_data.dart';

Future<void> showDeliveryStart(
    BuildContext context, EpiRepository repo, VoidCallback onSaved) async {
  final actionLock = UiActionLock.acquire(context, 'showDeliveryStart');
  if (actionLock == null) return;
  try {
    late List<Map<String, dynamic>> employees;
    late List<Map<String, dynamic>> stock;
    try {
      final values =
          await Future.wait([repo.fetchEpiEmployees(), repo.fetchEpiStock()]);
      employees = values[0];
      stock = availableEpiStockBatches(values[1]);
    } catch (e) {
      if (context.mounted) {
        showEpiMessage(context, 'Não foi possível carregar a entrega.');
      }
      return;
    }
    if (!context.mounted) return;
    String? employeeId = employees.firstOrNull?['id']?.toString();
    String category = 'all';
    String search = '';
    final selected = <String, int>{};
    String reason = 'initial';
    String? error;
    bool saving = false;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: false,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
          builder: (context, setLocal) => PopScope(
              canPop: !saving,
              child: SafeArea(
                  child: AbsorbPointer(
                absorbing: saving,
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
                              style:
                                  const TextStyle(color: Colors.orangeAccent)),
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
                                ButtonSegment(
                                    value: 'all', label: Text('Todos')),
                                ButtonSegment(
                                    value: 'epi', label: Text('EPIs')),
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
                                for (final batch in filterEpiStockBatches(
                                    stock, category, search))
                                  Builder(builder: (context) {
                                    final item = batch['epi_items'] as Map?;
                                    final id = batch['id'].toString();
                                    final available =
                                        (batch['quantity'] as num?)?.toInt() ??
                                            0;
                                    final amount = selected[id] ?? 0;
                                    final variant =
                                        batch['variant']?.toString().trim();
                                    final employee = employees
                                        .where((e) =>
                                            e['id']?.toString() == employeeId)
                                        .firstOrNull;
                                    final preferredBoot = isBootEpiItem(item) &&
                                        variant != null &&
                                        variant.isNotEmpty &&
                                        variant ==
                                            employee?['shoe_size']?.toString();
                                    return Card(
                                      color: epiCardColor,
                                      child: ListTile(
                                        leading: Icon(
                                            epiKindIcon(
                                                item?['item_kind']?.toString()),
                                            color: epiBlue),
                                        title: Text(
                                            '${item?['name'] ?? 'Item'}${variant == null || variant.isEmpty ? '' : isBootEpiItem(item) ? ' • Nº $variant' : ' • $variant'}'),
                                        subtitle: Text(
                                            '${epiKindLabel(item?['item_kind']?.toString())} • $available ${item?['unit'] ?? 'un'} disponíveis${preferredBoot ? '\nTamanho cadastrado do funcionário' : ''}'),
                                        isThreeLine: preferredBoot,
                                        trailing: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              IconButton(
                                                  onPressed: amount > 0
                                                      ? () => setLocal(() {
                                                            if (amount == 1) {
                                                              selected
                                                                  .remove(id);
                                                            } else {
                                                              selected[id] =
                                                                  amount - 1;
                                                            }
                                                          })
                                                      : null,
                                                  icon:
                                                      const Icon(Icons.remove)),
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
                              style: const TextStyle(color: epiBlue)),
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
                                  style: const TextStyle(
                                      color: Colors.redAccent))),
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: saving ||
                                  employeeId == null ||
                                  selected.isEmpty
                              ? null
                              : () async {
                                  if (saving) return;
                                  setLocal(() {
                                    saving = true;
                                    error = null;
                                  });
                                  try {
                                    final lines =
                                        buildEpiDeliveryLines(selected, stock);
                                    await repo.registerEpiDeliveryBatch(
                                        employeeId: employeeId!,
                                        lines: lines,
                                        reason: reason);
                                    if (context.mounted) Navigator.pop(context);
                                    onSaved();
                                  } catch (_) {
                                    if (context.mounted) {
                                      setLocal(() => error =
                                          'Não foi possível confirmar a entrega. Confira Relatórios antes de tentar novamente.');
                                    }
                                  } finally {
                                    if (context.mounted) {
                                      setLocal(() => saving = false);
                                    }
                                  }
                                },
                          icon: saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.check_circle_outline),
                          label: Text(
                              saving ? 'Registrando...' : 'Confirmar entrega'),
                        ),
                        TextButton(
                          onPressed:
                              saving ? null : () => Navigator.pop(context),
                          child: const Text('Cancelar'),
                        ),
                      ]),
                ),
              )))),
    );
  } finally {
    actionLock.release();
  }
}
