import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/features/epi/forms.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';
import 'package:metallo/features/epi/epi_view_data.dart';

class ItemsPage extends StatefulWidget {
  const ItemsPage({
    super.key,
    required this.repo,
    required this.role,
    this.refreshRevision = 0,
  });
  final EpiRepository repo;
  final String role;
  final int refreshRevision;
  @override
  State<ItemsPage> createState() => ItemsPageState();
}

class ItemsPageState extends State<ItemsPage> {
  late Future<List<Map<String, dynamic>>> future = widget.repo.fetchEpiItems();
  String query = '';
  String kind = 'all';
  void reload() => setState(() {
        future = widget.repo.fetchEpiItems();
      });

  @override
  void didUpdateWidget(covariant ItemsPage oldWidget) {
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
          final items = filterEpiCatalogItems(snap.data!, kind, query);
          return ListView(padding: const EdgeInsets.all(16), children: [
            const Text('Itens da COSEM',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
            const Text('Catálogos separados para não misturar controles.',
                style: TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            TextField(
              onChanged: (value) => setState(() => query = value),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Pesquisar por nome, código, CA ou marca',
              ),
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'all', label: Text('Todos')),
                  ButtonSegment(value: 'epi', label: Text('EPIs')),
                  ButtonSegment(
                      value: 'personal_tool', label: Text('Pessoais')),
                  ButtonSegment(value: 'uniform', label: Text('Fardas')),
                ],
                selected: {kind},
                onSelectionChanged: (value) =>
                    setState(() => kind = value.first),
              ),
            ),
            const SizedBox(height: 14),
            if (widget.role == 'admin')
              FilledButton.icon(
                  onPressed: () async {
                    final saved = await showItemForm(context, widget.repo);
                    if (!mounted) return;
                    if (saved) {
                      reload();
                    }
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Cadastrar item')),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(30),
                      child: Text('Nenhum item encontrado.'))),
            for (final item in items)
              _CatalogItemCard(
                item: item,
                onRegisterStock:
                    widget.role == 'admin' ? () => _registerStock(item) : null,
                onLongPress: widget.role == 'admin'
                    ? () => showItemActions(context, widget.repo, item, reload)
                    : null,
              ),
          ]);
        },
      );

  Future<void> _registerStock(Map<String, dynamic> item) async {
    final registered = await showStockForm(context, widget.repo, item);
    if (!mounted || !registered) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Entrada registrada na COSEM.')),
    );
  }
}

class _CatalogItemCard extends StatelessWidget {
  const _CatalogItemCard({
    required this.item,
    required this.onRegisterStock,
    required this.onLongPress,
  });

  final Map<String, dynamic> item;
  final VoidCallback? onRegisterStock;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) => Card(
        color: epiCardColor,
        child: ListTile(
          leading: Icon(
            epiKindIcon(item['item_kind']?.toString()),
            color: epiBlue,
          ),
          title: Text(
            item['name']?.toString() ?? 'Item',
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: Text(
            '${epiKindLabel(item['item_kind']?.toString())} • ${item['code']}${item['ca_number'] == null ? '' : ' • CA ${item['ca_number']}'}',
          ),
          trailing: onRegisterStock == null
              ? null
              : IconButton(
                  tooltip: 'Registrar entrada',
                  icon: const Icon(Icons.add_box_outlined),
                  onPressed: onRegisterStock,
                ),
          onLongPress: onLongPress,
        ),
      );
}
