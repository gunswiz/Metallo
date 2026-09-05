import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';
import 'package:metallo/features/epi/epi_view_data.dart';

class CosemPage extends StatefulWidget {
  const CosemPage({super.key, required this.repo});
  final EpiRepository repo;
  @override
  State<CosemPage> createState() => CosemPageState();
}

class CosemPageState extends State<CosemPage> {
  String query = '';
  String kind = 'all';
  late Future<List<List<Map<String, dynamic>>>> future = _load();

  Future<List<List<Map<String, dynamic>>>> _load() => Future.wait([
        widget.repo.fetchEpiStock(),
        widget.repo.fetchEpiRequests(),
      ]);

  void reload() => setState(() => future = _load());

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 2,
        child: Scaffold(
          appBar: AppBar(
            title: const Text('Estoque da COSEM'),
            actions: [
              IconButton(onPressed: reload, icon: const Icon(Icons.refresh))
            ],
            bottom: const TabBar(tabs: [
              Tab(text: 'Estoque'),
              Tab(text: 'Pendências'),
            ]),
          ),
          body: FutureBuilder<List<List<Map<String, dynamic>>>>(
            future: future,
            builder: (context, snap) {
              if (snap.hasError) return EpiModuleError(onRetry: reload);
              if (!snap.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              return TabBarView(children: [
                _stockTab(snap.data![0]),
                _pendingTab(snap.data![1], snap.data![0]),
              ]);
            },
          ),
        ),
      );

  Widget _stockTab(List<Map<String, dynamic>> batches) {
    final stockSummaries = summarizeEpiStock(batches);
    final items = filterEpiStockSummaries(stockSummaries, kind, query);
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(
        onChanged: (value) => setState(() => query = value),
        decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Pesquisar item no estoque'),
      ),
      const SizedBox(height: 10),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'all', label: Text('Todos')),
            ButtonSegment(value: 'epi', label: Text('EPIs')),
            ButtonSegment(value: 'personal_tool', label: Text('Pessoais')),
            ButtonSegment(value: 'uniform', label: Text('Fardas')),
          ],
          selected: {kind},
          onSelectionChanged: (value) => setState(() => kind = value.first),
        ),
      ),
      const SizedBox(height: 12),
      for (final item in items)
        _CosemStockCard(
          item: item,
          onShowVariants: () => _showVariantStock(item),
        ),
      if (items.isEmpty)
        const Padding(
            padding: EdgeInsets.all(30),
            child: Center(child: Text('Nenhum item encontrado.'))),
    ]);
  }

  Future<void> _showVariantStock(Map<String, dynamic> item) async {
    final variants = Map<String, int>.from(item['variants'] as Map);
    final rows = variants.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(item['name']?.toString() ?? 'Estoque por variação',
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('${item['quantity']} ${item['unit'] ?? 'un'} no total',
                style: const TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            for (final row in rows)
              ListTile(
                leading: const CircleAvatar(
                    backgroundColor: metalloEpiIconBackground,
                    child: Icon(Icons.inventory_2_outlined, color: epiBlue)),
                title: Text(
                    item['code'] == 'EPI-BOT' ? 'Número ${row.key}' : row.key),
                trailing: Text('${row.value} ${item['unit'] ?? 'un'}',
                    style: const TextStyle(
                        color: epiBlue,
                        fontSize: 17,
                        fontWeight: FontWeight.w900)),
              ),
          ]),
        ),
      ),
    );
  }

  Widget _pendingTab(
      List<Map<String, dynamic>> requests, List<Map<String, dynamic>> batches) {
    final pending = pendingEpiRequests(requests);
    if (pending.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: epiBlue.withValues(alpha: .12),
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.task_alt_rounded, color: epiBlue, size: 36),
            ),
            const SizedBox(height: 18),
            const Text('Nenhuma pendência aberta',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text(
              'As solicitações feitas nos funcionários aparecerão aqui para atendimento.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white60, height: 1.35),
            ),
          ]),
        ),
      );
    }
    return ListView(padding: const EdgeInsets.all(16), children: [
      const Text('Solicitações aguardando atendimento',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
      const SizedBox(height: 4),
      const Text('Toque em Atender para entregar diretamente da COSEM.',
          style: TextStyle(color: Colors.white60)),
      const SizedBox(height: 12),
      for (final request in pending)
        Card(
          color: epiCardColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: BorderSide(color: epiBlue.withValues(alpha: .28)),
          ),
          child: ListTile(
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: epiBlue.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(13),
              ),
              child: const Icon(Icons.schedule_rounded, color: epiBlue),
            ),
            title: Text(
                (request['epi_items'] as Map?)?['name']?.toString() ?? 'Item',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(
                '${(request['epi_employees'] as Map?)?['full_name'] ?? 'Funcionário'} • ${(request['teams'] as Map?)?['name'] ?? 'Equipe'}\n${request['quantity']} ${(request['epi_items'] as Map?)?['unit'] ?? 'un'}${request['requested_variant'] == null ? '' : ' • ${request['requested_variant']}'}'),
            isThreeLine: true,
            trailing: SizedBox(
              width: 76,
              height: 36,
              child: FilledButton(
                onPressed: () => _fulfill(request, batches),
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                ),
                child: const Text('Atender',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
              ),
            ),
          ),
        ),
    ]);
  }

  Future<void> _fulfill(
      Map<String, dynamic> request, List<Map<String, dynamic>> batches) async {
    final actionLock = UiActionLock.acquire(context, '_fulfill');
    if (actionLock == null) return;
    try {
      final available = stockBatchesForEpiRequest(request, batches);
      if (available.isEmpty) {
        showEpiMessage(
            context, 'Não há estoque suficiente para esta pendência.');
        return;
      }
      final item = request['epi_items'] as Map?;
      final employee = request['epi_employees'] as Map?;
      final code = item?['code']?.toString();
      final shoeSize = employee?['shoe_size']?.toString();
      bool batchChosen = false;
      final selected = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        showDragHandle: true,
        builder: (context) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            children: [
              Text('Escolha no estoque: ${item?['name'] ?? 'item'}',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              for (final batch in available)
                ListTile(
                  leading:
                      const Icon(Icons.inventory_2_outlined, color: epiBlue),
                  title: Text(batch['variant'] == null
                      ? 'Sem variação'
                      : code == 'EPI-BOT'
                          ? 'Número ${batch['variant']}'
                          : batch['variant'].toString()),
                  subtitle: Text(
                      '${batch['quantity']} ${item?['unit'] ?? 'un'} disponíveis${code == 'EPI-BOT' && batch['variant']?.toString() == shoeSize ? ' • número do funcionário' : ''}'),
                  onTap: () {
                    if (batchChosen) return;
                    batchChosen = true;
                    Navigator.pop(context, batch);
                  },
                ),
            ],
          ),
        ),
      );
      if (selected == null) return;
      try {
        await widget.repo.fulfillEpiRequest(
            request['id'].toString(), selected['id'].toString());
        if (!mounted) return;
        reload();
        showEpiMessage(
            context, 'Pendência atendida e entregue ao funcionário.');
      } catch (_) {
        if (mounted) {
          showEpiMessage(context,
              'Estoque insuficiente ou pendência já atendida. Confira o estoque.');
        }
      }
    } finally {
      actionLock.release();
    }
  }
}

class _CosemStockCard extends StatelessWidget {
  const _CosemStockCard({
    required this.item,
    required this.onShowVariants,
  });

  final Map<String, dynamic> item;
  final VoidCallback onShowVariants;

  @override
  Widget build(BuildContext context) {
    final hasVariants = (item['variants'] as Map).isNotEmpty;
    final itemKind = item['item_kind']?.toString();
    return Card(
      color: epiCardColor,
      child: ListTile(
        onLongPress: hasVariants ? onShowVariants : null,
        leading: Icon(epiKindIcon(itemKind), color: epiBlue),
        title: Text(
          item['name']?.toString() ?? 'Item',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(hasVariants
            ? '${epiKindLabel(itemKind)} • ${item['code']}\nPressione para ver cada variação'
            : '${epiKindLabel(itemKind)} • ${item['code']}'),
        isThreeLine: hasVariants,
        trailing: Text(
          '${item['quantity']} ${item['unit'] ?? 'un'}',
          style: const TextStyle(
            color: epiBlue,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
