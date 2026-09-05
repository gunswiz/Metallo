import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';
import 'package:metallo/features/epi/employee_details.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key, required this.repo});
  final EpiRepository repo;
  @override
  State<ReportsPage> createState() => ReportsPageState();
}

class ReportsPageState extends State<ReportsPage> {
  late Future<List<Map<String, dynamic>>> future =
      widget.repo.fetchEpiDeliveries();

  void reload() => setState(() => future = widget.repo.fetchEpiDeliveries());

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
                                    '${row['quantity']} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'} • ${epiStatusLabel(row['current_status']?.toString())}${row['variant_snapshot'] == null ? '' : ' • ${(row['epi_items'] as Map?)?['code'] == 'EPI-BOT' ? 'Nº ' : ''}${row['variant_snapshot']}'}${row['ca_snapshot'] == null ? '' : ' • CA ${row['ca_snapshot']}'}'),
                                trailing: row['current_status'] == 'active'
                                    ? const Icon(Icons.chevron_right_rounded)
                                    : null,
                                onTap: row['current_status'] == 'active'
                                    ? () async {
                                        final status =
                                            await showModalBottomSheet<String>(
                                                context: sheetContext,
                                                builder: (actionContext) =>
                                                    SafeArea(
                                                      child: Wrap(children: [
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .keyboard_return),
                                                            title: const Text(
                                                                'Devolvido'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'returned')),
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .build_outlined),
                                                            title: const Text(
                                                                'Danificado'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'damaged')),
                                                        ListTile(
                                                            leading: const Icon(
                                                                Icons
                                                                    .help_outline),
                                                            title: const Text(
                                                                'Perdido'),
                                                            onTap: () =>
                                                                Navigator.pop(
                                                                    actionContext,
                                                                    'lost')),
                                                      ]),
                                                    ));
                                        if (status == null) return;
                                        await repo.closeEpiDelivery(
                                            row['id'].toString(), status);
                                        if (sheetContext.mounted) {
                                          Navigator.pop(sheetContext);
                                          onChanged();
                                          showEpiMessage(context,
                                              'Situação do item atualizada.');
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
