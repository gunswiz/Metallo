import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/08_ESTILOS/theme.dart';
import 'package:metallo/06_ACESSO_A_DADOS/epi_repository.dart';
import 'package:metallo/01_TELAS/04_EPIS_E_FUNCIONARIOS/epi_ui.dart';
import 'package:metallo/01_TELAS/04_EPIS_E_FUNCIONARIOS/epi_catalog.dart';
import 'package:metallo/01_TELAS/04_EPIS_E_FUNCIONARIOS/employee_details.dart';
import 'package:metallo/02_COMPONENTES/ui_action_lock.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({
    super.key,
    required this.repo,
    this.refreshRevision = 0,
  });
  final EpiRepository repo;
  final int refreshRevision;
  @override
  State<ReportsPage> createState() => ReportsPageState();
}

class ReportsPageState extends State<ReportsPage> {
  late Future<List<Map<String, dynamic>>> future =
      widget.repo.fetchEpiDeliveries();

  void reload() => setState(() {
        future = widget.repo.fetchEpiDeliveries();
      });

  @override
  void didUpdateWidget(covariant ReportsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshRevision != widget.refreshRevision) reload();
  }

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return EpiModuleError(onRetry: reload);
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
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
                color: epiCardColor,
                child: ListTile(
                  leading: const CircleAvatar(
                      backgroundColor: metalloEpiIconBackground,
                      child: Icon(Icons.assignment_turned_in_outlined,
                          color: epiBlue)),
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

Future<({int quantity, String status})?> _showDeliveryCloseSheet(
    BuildContext context, Map<String, dynamic> row) {
  final maximum = int.tryParse(row['quantity']?.toString() ?? '') ?? 1;
  var quantity = 1;
  final itemName = (row['epi_items'] as Map?)?['name']?.toString() ?? 'Item';
  final unit = (row['epi_items'] as Map?)?['unit']?.toString() ?? 'un';

  return showModalBottomSheet<({int quantity, String status})>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (actionContext) => StatefulBuilder(
      builder: (context, setSheetState) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(itemName,
                    style: const TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w900)),
              ),
              const SizedBox(height: 4),
              const Align(
                alignment: Alignment.centerLeft,
                child: Text('Quantidade a atualizar',
                    style: TextStyle(color: Colors.white60)),
              ),
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: epiCardColor,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(children: [
                  IconButton(
                    tooltip: 'Diminuir quantidade',
                    onPressed: quantity > 1
                        ? () => setSheetState(() => quantity--)
                        : null,
                    icon: const Icon(Icons.remove_circle_outline_rounded),
                  ),
                  Expanded(
                    child: Text('$quantity de $maximum $unit',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w800)),
                  ),
                  IconButton(
                    tooltip: 'Aumentar quantidade',
                    onPressed: quantity < maximum
                        ? () => setSheetState(() => quantity++)
                        : null,
                    icon: const Icon(Icons.add_circle_outline_rounded),
                  ),
                ]),
              ),
              const SizedBox(height: 10),
              ListTile(
                leading: const Icon(Icons.keyboard_return, color: epiBlue),
                title: const Text('Devolvido'),
                onTap: () => Navigator.pop(
                    actionContext, (quantity: quantity, status: 'returned')),
              ),
              ListTile(
                leading: const Icon(Icons.build_outlined, color: epiBlue),
                title: const Text('Danificado'),
                onTap: () => Navigator.pop(
                    actionContext, (quantity: quantity, status: 'damaged')),
              ),
              ListTile(
                leading: const Icon(Icons.help_outline, color: epiBlue),
                title: const Text('Perdido'),
                onTap: () => Navigator.pop(
                    actionContext, (quantity: quantity, status: 'lost')),
              ),
            ]),
          ),
        ),
      ),
    ),
  );
}

void _deliveryGroupDetails(BuildContext context, EpiRepository repo,
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
                        style: TextStyle(
                            fontSize: 22, fontWeight: FontWeight.w900)),
                    Text(
                        (rows.first['epi_employees'] as Map?)?['full_name']
                                ?.toString() ??
                            '',
                        style: const TextStyle(color: Colors.white60)),
                    const SizedBox(height: 14),
                    epiDeliveryDetail(
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
                              color: epiCardColor,
                              child: ListTile(
                                leading: Icon(
                                    epiKindIcon(
                                        (row['epi_items'] as Map?)?['item_kind']
                                            ?.toString()),
                                    color: epiBlue),
                                title: Text(
                                    (row['epi_items'] as Map?)?['name']
                                            ?.toString() ??
                                        'Item',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800)),
                                subtitle: Text(
                                    '${row['quantity']} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'} • ${epiStatusLabel(row['current_status']?.toString())}${row['variant_snapshot'] == null ? '' : ' • ${isBootEpiItem(row['epi_items'] as Map?) ? 'Nº ' : ''}${row['variant_snapshot']}'}${row['ca_snapshot'] == null ? '' : ' • CA ${row['ca_snapshot']}'}'),
                                trailing: row['current_status'] == 'active'
                                    ? const Icon(Icons.chevron_right_rounded)
                                    : null,
                                onTap: row['current_status'] == 'active'
                                    ? () async {
                                        final choice =
                                            await _showDeliveryCloseSheet(
                                                sheetContext, row);
                                        if (choice == null ||
                                            !sheetContext.mounted) {
                                          return;
                                        }
                                        final actionLock = UiActionLock.acquire(
                                            sheetContext,
                                            'close-epi-delivery-${row['id']}');
                                        if (actionLock == null) return;
                                        try {
                                          await repo.closeEpiDelivery(
                                              row['id'].toString(),
                                              choice.status,
                                              quantity: choice.quantity);
                                          if (sheetContext.mounted) {
                                            Navigator.pop(sheetContext);
                                            onChanged();
                                          }
                                          if (context.mounted) {
                                            showEpiMessage(context,
                                                '${choice.quantity} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'} atualizado(s) no histórico.');
                                          }
                                        } catch (_) {
                                          if (context.mounted) {
                                            showEpiMessage(context,
                                                'Não foi possível atualizar a situação do item.');
                                          }
                                        } finally {
                                          actionLock.release();
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
