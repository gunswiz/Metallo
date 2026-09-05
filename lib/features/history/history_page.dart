import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/empty_state.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/features/history/helpers.dart';
import 'package:metallo/features/history/dialogs.dart';

const _historyFilterOptions = <(String, String, IconData)>[
  ('entry', 'Entrada de material', Icons.move_to_inbox_outlined),
  ('consumption', 'Consumo de material', Icons.construction_rounded),
  ('replenishment', 'Reposição COSEM → equipe', Icons.inventory_2_outlined),
  ('transfer', 'Transferência de equipamento', Icons.swap_horiz_rounded),
  ('adjustment', 'Ajuste de estoque', Icons.tune_rounded),
  ('maintenance', 'Manutenção', Icons.build_outlined),
  ('return', 'Retorno', Icons.keyboard_return_rounded),
];

class HistoryPage extends StatefulWidget {
  const HistoryPage(
      {super.key,
      required this.movementRepository,
      required this.dashboardRepository,
      required this.stream,
      required this.isAdmin});
  final MovementRepository movementRepository;
  final DashboardRepository dashboardRepository;
  final Stream<DashboardSnapshot> stream;
  final bool isAdmin;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final search = TextEditingController();
  final Set<String> movementFilters = {};
  void reload() => setState(() {});

  List<Map<String, dynamic>> _filteredRows(List<Map<String, dynamic>> rows) {
    final query = search.text.trim().toLowerCase();
    return rows
        .where((row) => query.isEmpty || historySearchText(row).contains(query))
        .where((row) =>
            movementFilters.isEmpty ||
            movementFilters.contains(row['movement_type']?.toString() ?? ''))
        .toList();
  }

  Future<void> _showHistoryFilters(BuildContext context) async {
    final result = await showModalBottomSheet<Set<String>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) =>
          _HistoryFilterSheet(initialFilters: movementFilters),
    );
    if (result != null && mounted) {
      setState(() {
        movementFilters
          ..clear()
          ..addAll(result);
      });
    }
  }

  Future<void> _handleEntryAction(
    BuildContext context,
    String action,
    Map<String, dynamic> row,
    List<Team> teams,
  ) async {
    final isMaterial = row['_kind'] == 'material';
    if (action == 'edit') {
      try {
        if (isMaterial) {
          await showMaterialHistoryEdit(
              context, widget.movementRepository, teams, row);
        } else {
          await showAssetHistoryEdit(
              context, widget.movementRepository, teams, row);
        }
        reload();
      } catch (error) {
        if (context.mounted) showError(context, error);
      }
      return;
    }

    final shouldDelete = await confirm(
      context,
      'Excluir registro?',
      'A exclusão também desfaz o efeito desta movimentação no estoque/localização.',
    );
    if (shouldDelete != true) return;
    try {
      if (isMaterial) {
        await widget.movementRepository
            .deleteMaterialHistory(row['id'].toString());
      } else {
        await widget.movementRepository
            .deleteAssetHistory(row['id'].toString());
      }
      reload();
    } catch (error) {
      if (context.mounted) showError(context, error);
    }
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.dashboardRepository.watchDashboard(),
      builder: (context, dSnap) {
        if (!dSnap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final teams = dSnap.data!.teams;

        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.movementRepository.fetchHistory(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final rows = _filteredRows(snap.data!);

            return RefreshIndicator(
              onRefresh: () async {
                reload();
                await widget.dashboardRepository.refreshDashboard();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                children: [
                  TextField(
                    controller: search,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText:
                          'Pesquisar histórico por nome, código ou movimentação',
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
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _showHistoryFilters(context),
                          icon: const Icon(Icons.tune_rounded),
                          label: Text(movementFilters.isEmpty
                              ? 'Filtrar histórico'
                              : 'Filtros (${movementFilters.length})'),
                        ),
                      ),
                      if (movementFilters.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        IconButton(
                          tooltip: 'Limpar filtros',
                          onPressed: () => setState(movementFilters.clear),
                          icon: const Icon(Icons.filter_alt_off_outlined),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (snap.data!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 50),
                      child: EmptyState(
                        icon: Icons.history,
                        title: 'Histórico vazio',
                        subtitle:
                            'As entradas e movimentações aparecerão aqui.',
                      ),
                    )
                  else if (rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: EmptyState(
                        icon: Icons.search_off,
                        title: 'Nenhuma movimentação encontrada',
                        subtitle:
                            'Tente outro nome, código, equipe ou tipo de movimentação.',
                      ),
                    )
                  else
                    for (final row in rows)
                      _HistoryEntryCard(
                        row: row,
                        data: HistoryEntryViewData.fromRow(row),
                        isAdmin: widget.isAdmin,
                        onAction: (action) =>
                            _handleEntryAction(context, action, row, teams),
                      ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class _HistoryFilterSheet extends StatefulWidget {
  const _HistoryFilterSheet({required this.initialFilters});

  final Set<String> initialFilters;

  @override
  State<_HistoryFilterSheet> createState() => _HistoryFilterSheetState();
}

class _HistoryFilterSheetState extends State<_HistoryFilterSheet> {
  late final Set<String> draft = Set<String>.from(widget.initialFilters);

  void _toggleFilter(String value, bool selected) {
    setState(() {
      if (selected) {
        draft.add(value);
      } else {
        draft.remove(value);
      }
    });
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Filtrar histórico',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 6),
              const Text(
                  'Marque uma ou mais operações. Sem seleção, o histórico mostra tudo.',
                  style: TextStyle(color: Colors.white60)),
              const SizedBox(height: 10),
              for (final option in _historyFilterOptions)
                CheckboxListTile(
                  value: draft.contains(option.$1),
                  secondary: Icon(option.$3),
                  title: Text(option.$2),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                  onChanged: (checked) =>
                      _toggleFilter(option.$1, checked ?? false),
                ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(draft.clear),
                    child: const Text('Limpar'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => Navigator.pop(context, draft),
                    child: const Text('Aplicar'),
                  ),
                ),
              ]),
            ],
          ),
        ),
      );
}

class _HistoryEntryCard extends StatelessWidget {
  const _HistoryEntryCard({
    required this.row,
    required this.data,
    required this.isAdmin,
    required this.onAction,
  });

  final Map<String, dynamic> row;
  final HistoryEntryViewData data;
  final bool isAdmin;
  final ValueChanged<String> onAction;

  @override
  Widget build(BuildContext context) => Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: data.accent.withValues(alpha: .55)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => showHistoryDetails(context, row),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 54,
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: HistoryMovementIcon(
                      isMaterial: data.isMaterial,
                      movementType: data.movementType,
                      color: data.accent,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(child: _HistoryEntryDetails(row: row, data: data)),
                if (isAdmin)
                  PopupMenuButton<String>(
                    onSelected: onAction,
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'edit', child: Text('Corrigir')),
                      PopupMenuItem(value: 'delete', child: Text('Excluir')),
                    ],
                  )
                else
                  const Padding(
                    padding: EdgeInsets.only(top: 18, right: 6),
                    child: Icon(Icons.chevron_right, color: Colors.white38),
                  ),
              ],
            ),
          ),
        ),
      );
}

class _HistoryEntryDetails extends StatelessWidget {
  const _HistoryEntryDetails({required this.row, required this.data});

  final Map<String, dynamic> row;
  final HistoryEntryViewData data;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(data.title,
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
          const SizedBox(height: 3),
          Text(
            [
              if (data.code.isNotEmpty) data.code,
              if (!data.isMaterial && data.assetCode.isNotEmpty) data.assetCode,
            ].join(' • '),
            style: TextStyle(
              color: data.accent,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 8),
          Text(data.mainAction,
              style: const TextStyle(fontWeight: FontWeight.w700)),
          if (data.isMaterial) ...[
            const SizedBox(height: 3),
            Text('Quantidade: ${row['quantity'] ?? 0}'),
          ],
          const SizedBox(height: 7),
          Row(children: [
            const Icon(Icons.schedule, size: 15, color: Colors.white54),
            const SizedBox(width: 5),
            Text(formatHistoryDateTime(row['created_at']),
                style: const TextStyle(color: Colors.white60, fontSize: 12)),
          ]),
          if (row['note'] != null &&
              row['note'].toString().trim().isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(row['note'].toString(),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white70)),
          ],
          const SizedBox(height: 5),
          const Text('Toque para ver os detalhes',
              style: TextStyle(color: Colors.white38, fontSize: 11)),
        ],
      );
}
