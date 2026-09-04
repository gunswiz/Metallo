part of '../../app.dart';

class MaterialCatalogDrawer extends StatefulWidget {
  const MaterialCatalogDrawer(
      {super.key, required this.repo, required this.isAdmin});
  final MetalloRepository repo;
  final bool isAdmin;

  @override
  State<MaterialCatalogDrawer> createState() => _MaterialCatalogDrawerState();
}

class _MaterialCatalogDrawerState extends State<MaterialCatalogDrawer> {
  late Future<List<Map<String, dynamic>>> catalog =
      widget.repo.fetchMaterialCatalog();
  void reload() => setState(() => catalog = widget.repo.fetchMaterialCatalog());

  @override
  Widget build(BuildContext context) => Drawer(
        width: MediaQuery.sizeOf(context).width * .90,
        backgroundColor: const Color(0xFF0A0F16),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 8, 10),
                child: Row(children: [
                  const Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text('Catálogo de materiais',
                            style: TextStyle(
                                fontSize: 21, fontWeight: FontWeight.w900)),
                        Text('Ordenado pelo código global',
                            style: TextStyle(color: Colors.white60)),
                      ])),
                  IconButton(
                      onPressed: reload, icon: const Icon(Icons.refresh)),
                  IconButton(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close)),
                ]),
              ),
              const Divider(height: 1),
              Expanded(
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: catalog,
                  builder: (context, snap) {
                    if (snap.hasError) return ErrorState(error: snap.error);
                    if (!snap.hasData)
                      return const Center(child: CircularProgressIndicator());
                    if (snap.data!.isEmpty)
                      return const Center(
                          child: Text('Nenhum material cadastrado.'));
                    return ListView.separated(
                      padding: const EdgeInsets.all(10),
                      itemCount: snap.data!.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final m = snap.data![i];
                        return ListTile(
                          leading: Container(
                            constraints: const BoxConstraints(minWidth: 58),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 8, vertical: 7),
                            decoration: BoxDecoration(
                                color: const Color(0xFF0E3965),
                                borderRadius: BorderRadius.circular(9)),
                            child: Text(m['code']?.toString() ?? '-',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: Color(0xFF8CC8FF),
                                    fontWeight: FontWeight.w900)),
                          ),
                          title: Text(m['name']?.toString() ?? ''),
                          subtitle: Text(
                              '${m['unit'] ?? 'un'}${(m['category']?.toString().isNotEmpty ?? false) ? ' • ${m['category']}' : ''}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Total: ${(m['total_quantity'] as num?)?.toInt() ?? 0} ${m['unit'] ?? 'un'}',
                                style: const TextStyle(
                                    color: Color(0xFF89CFF0),
                                    fontWeight: FontWeight.w900),
                              ),
                              if (widget.isAdmin)
                                PopupMenuButton<String>(
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      final changed =
                                          await showEditMaterialCatalogDialog(
                                              context, widget.repo, m);
                                      if (changed == true) reload();
                                    } else if (value == 'delete') {
                                      final ok = await confirm(
                                          context,
                                          'Excluir material?',
                                          'O material será retirado do catálogo. Por segurança, a exclusão só é permitida quando não houver saldo em nenhuma localização. O histórico será preservado.');
                                      if (ok == true) {
                                        try {
                                          await widget.repo
                                              .deactivateMaterialItem(
                                                  m['id'].toString());
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
                                        value: 'edit', child: Text('Editar')),
                                    PopupMenuItem(
                                        value: 'delete',
                                        child: Text('Excluir')),
                                  ],
                                ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
}
