part of '../../app.dart';

class _ItemsPage extends StatefulWidget {
  const _ItemsPage({required this.repo, required this.role});
  final EpiRepository repo;
  final String role;
  @override
  State<_ItemsPage> createState() => _ItemsPageState();
}

class _ItemsPageState extends State<_ItemsPage> {
  late Future<List<Map<String, dynamic>>> future = widget.repo.fetchEpiItems();
  String query = '';
  String kind = 'all';
  void reload() => setState(() => future = widget.repo.fetchEpiItems());
  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return _ModuleError(onRetry: reload);
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final normalizedQuery = query.trim().toLowerCase();
          final items = snap.data!.where((item) {
            final matchesKind = kind == 'all' || item['item_kind'] == kind;
            final searchable = [
              item['name'],
              item['code'],
              item['ca_number'],
              item['brand_model']
            ].whereType<Object>().join(' ').toLowerCase();
            return matchesKind && searchable.contains(normalizedQuery);
          }).toList();
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
                    final saved = await _itemForm(context, widget.repo);
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
              Card(
                color: _epiCard,
                child: ListTile(
                  leading: Icon(_kindIcon(item['item_kind']?.toString()),
                      color: _epiBlue),
                  title: Text(item['name']?.toString() ?? 'Item',
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(
                      '${_kindLabel(item['item_kind']?.toString())} • ${item['code']}${item['ca_number'] == null ? '' : ' • CA ${item['ca_number']}'}'),
                  trailing: widget.role == 'admin'
                      ? IconButton(
                          tooltip: 'Registrar entrada',
                          icon: const Icon(Icons.add_box_outlined),
                          onPressed: () async {
                            final registered =
                                await _stockForm(context, widget.repo, item);
                            if (!mounted) return;
                            if (registered) {
                              ScaffoldMessenger.of(this.context).showSnackBar(
                                  const SnackBar(
                                      content: Text(
                                          'Entrada registrada na COSEM.')));
                            }
                          })
                      : null,
                  onLongPress: widget.role == 'admin'
                      ? () => _itemActions(context, widget.repo, item, reload)
                      : null,
                ),
              ),
          ]);
        },
      );
}
