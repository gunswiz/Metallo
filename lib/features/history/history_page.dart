part of '../../app.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage(
      {super.key,
      required this.repo,
      required this.stream,
      required this.isAdmin});
  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;
  final bool isAdmin;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final search = TextEditingController();
  final Set<String> movementFilters = {};
  void reload() => setState(() {});

  Future<void> _showHistoryFilters(BuildContext context) async {
    final draft = Set<String>.from(movementFilters);
    final result = await showModalBottomSheet<Set<String>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) {
          const options = <(String, String, IconData)>[
            ('entry', 'Entrada de material', Icons.move_to_inbox_outlined),
            ('consumption', 'Consumo de material', Icons.construction_rounded),
            (
              'replenishment',
              'Reposição COSEM → equipe',
              Icons.inventory_2_outlined
            ),
            (
              'transfer',
              'Transferência de equipamento',
              Icons.swap_horiz_rounded
            ),
            ('adjustment', 'Ajuste de estoque', Icons.tune_rounded),
            ('maintenance', 'Manutenção', Icons.build_outlined),
            ('return', 'Retorno', Icons.keyboard_return_rounded),
          ];
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Filtrar histórico',
                      style:
                          TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  const Text(
                      'Marque uma ou mais operações. Sem seleção, o histórico mostra tudo.',
                      style: TextStyle(color: Colors.white60)),
                  const SizedBox(height: 10),
                  for (final option in options)
                    CheckboxListTile(
                      value: draft.contains(option.$1),
                      secondary: Icon(option.$3),
                      title: Text(option.$2),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      onChanged: (checked) => setSheet(() {
                        if (checked ?? false) {
                          draft.add(option.$1);
                        } else {
                          draft.remove(option.$1);
                        }
                      }),
                    ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                        child: OutlinedButton(
                            onPressed: () => setSheet(draft.clear),
                            child: const Text('Limpar'))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: FilledButton(
                            onPressed: () => Navigator.pop(context, draft),
                            child: const Text('Aplicar'))),
                  ]),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (result != null && mounted)
      setState(() {
        movementFilters
          ..clear()
          ..addAll(result);
      });
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.watchDashboard(),
      builder: (context, dSnap) {
        if (!dSnap.hasData)
          return const Center(child: CircularProgressIndicator());
        final teams = dSnap.data!.teams;

        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.repo.fetchHistory(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData)
              return const Center(child: CircularProgressIndicator());
            final q = search.text.trim().toLowerCase();
            final rows = snap.data!
                .where((row) => q.isEmpty || historySearchText(row).contains(q))
                .where((row) =>
                    movementFilters.isEmpty ||
                    movementFilters
                        .contains(row['movement_type']?.toString() ?? ''))
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                reload();
                await widget.repo.refreshDashboard();
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
                      Builder(builder: (context) {
                        final isMaterial = row['_kind'] == 'material';
                        final title = isMaterial
                            ? ((row['items'] as Map?)?['name']?.toString() ??
                                'Material')
                            : (((row['assets'] as Map?)?['items']
                                        as Map?)?['name']
                                    ?.toString() ??
                                'Equipamento');
                        final item = isMaterial
                            ? row['items'] as Map?
                            : (row['assets'] as Map?)?['items'] as Map?;
                        final code = item?['code']?.toString() ?? '';
                        final assetCode = (row['assets'] as Map?)?['asset_code']
                                ?.toString() ??
                            '';
                        final origin =
                            (row['origin'] as Map?)?['name']?.toString();
                        final destination =
                            (row['destination'] as Map?)?['name']?.toString();
                        final movementType =
                            row['movement_type']?.toString() ?? '';
                        final accent =
                            historyAccentColor(isMaterial, movementType);
                        final mainAction = [
                          movementLabel(movementType),
                          if (origin != null) origin,
                          if (destination != null) destination,
                        ].join(' → ');

                        return Card(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                                color: accent.withValues(alpha: .55)),
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
                                        isMaterial: isMaterial,
                                        movementType: movementType,
                                        color: accent,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(title,
                                            style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w900)),
                                        const SizedBox(height: 3),
                                        Text(
                                          [
                                            if (code.isNotEmpty) code,
                                            if (!isMaterial &&
                                                assetCode.isNotEmpty)
                                              assetCode
                                          ].join(' • '),
                                          style: TextStyle(
                                              color: accent,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(mainAction,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w700)),
                                        if (isMaterial) ...[
                                          const SizedBox(height: 3),
                                          Text(
                                              'Quantidade: ${row['quantity'] ?? 0}'),
                                        ],
                                        const SizedBox(height: 7),
                                        Row(
                                          children: [
                                            const Icon(Icons.schedule,
                                                size: 15,
                                                color: Colors.white54),
                                            const SizedBox(width: 5),
                                            Text(
                                                formatHistoryDateTime(
                                                    row['created_at']),
                                                style: const TextStyle(
                                                    color: Colors.white60,
                                                    fontSize: 12)),
                                          ],
                                        ),
                                        if (row['note'] != null &&
                                            row['note']
                                                .toString()
                                                .trim()
                                                .isNotEmpty) ...[
                                          const SizedBox(height: 5),
                                          Text(row['note'].toString(),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                  color: Colors.white70)),
                                        ],
                                        const SizedBox(height: 5),
                                        const Text('Toque para ver os detalhes',
                                            style: TextStyle(
                                                color: Colors.white38,
                                                fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  if (widget.isAdmin)
                                    PopupMenuButton<String>(
                                      onSelected: (action) async {
                                        if (action == 'edit') {
                                          try {
                                            if (isMaterial) {
                                              await showMaterialHistoryEdit(
                                                  context,
                                                  widget.repo,
                                                  teams,
                                                  row);
                                            } else {
                                              await showAssetHistoryEdit(
                                                  context,
                                                  widget.repo,
                                                  teams,
                                                  row);
                                            }
                                            reload();
                                          } catch (e) {
                                            if (context.mounted)
                                              showError(context, e);
                                          }
                                        } else if (action == 'delete') {
                                          final yes = await confirm(
                                            context,
                                            'Excluir registro?',
                                            'A exclusão também desfaz o efeito desta movimentação no estoque/localização.',
                                          );
                                          if (yes == true) {
                                            try {
                                              if (isMaterial) {
                                                await widget.repo
                                                    .deleteMaterialHistory(
                                                        row['id'].toString());
                                              } else {
                                                await widget.repo
                                                    .deleteAssetHistory(
                                                        row['id'].toString());
                                              }
                                              reload();
                                            } catch (e) {
                                              if (context.mounted)
                                                showError(context, e);
                                            }
                                          }
                                        }
                                      },
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(
                                            value: 'edit',
                                            child: Text('Corrigir')),
                                        PopupMenuItem(
                                            value: 'delete',
                                            child: Text('Excluir')),
                                      ],
                                    )
                                  else
                                    const Padding(
                                      padding:
                                          EdgeInsets.only(top: 18, right: 6),
                                      child: Icon(Icons.chevron_right,
                                          color: Colors.white38),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
