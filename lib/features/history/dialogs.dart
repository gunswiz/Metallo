part of '../../app.dart';

Future<void> showHistoryDetails(
    BuildContext context, Map<String, dynamic> row) async {
  final isMaterial = row['_kind'] == 'material';
  final item = isMaterial
      ? row['items'] as Map?
      : (row['assets'] as Map?)?['items'] as Map?;
  final asset = row['assets'] as Map?;
  final origin = (row['origin'] as Map?)?['name']?.toString();
  final destination = (row['destination'] as Map?)?['name']?.toString();
  final note = row['note']?.toString();
  final movement = movementLabel(row['movement_type']?.toString() ?? '');
  final name =
      item?['name']?.toString() ?? (isMaterial ? 'Material' : 'Equipamento');
  final code = item?['code']?.toString();
  final assetCode = asset?['asset_code']?.toString();
  final previousStatus = row['previous_status']?.toString();
  final newStatus = row['new_status']?.toString();

  Widget line(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: metalloAccent),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style:
                          const TextStyle(color: Colors.white60, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(value,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      );

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF0A0F16),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            20, 18, 20, 24 + MediaQuery.viewInsetsOf(sheetContext).bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    icon: const Icon(Icons.close)),
              ],
            ),
            Text(movement,
                style: const TextStyle(
                    color: Color(0xFF8CC8FF), fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            const Divider(),
            line(Icons.calendar_month_outlined, 'Data e horário',
                formatHistoryDateTime(row['created_at'])),
            if ((code ?? '').isNotEmpty) line(Icons.tag, 'Código', code!),
            if (!isMaterial && (assetCode ?? '').isNotEmpty)
              line(Icons.tag_outlined, 'Patrimônio / código individual',
                  assetCode!),
            if (isMaterial)
              line(Icons.numbers, 'Quantidade', '${row['quantity'] ?? 0}'),
            if (origin != null && origin.isNotEmpty)
              line(Icons.logout, 'Origem', origin),
            if (destination != null && destination.isNotEmpty)
              line(Icons.login, 'Destino', destination),
            if (!isMaterial && (previousStatus ?? '').isNotEmpty)
              line(Icons.swap_horiz, 'Status anterior',
                  statusLabel(previousStatus!)),
            if (!isMaterial && (newStatus ?? '').isNotEmpty)
              line(Icons.check_circle_outline, 'Novo status',
                  statusLabel(newStatus!)),
            if (note != null && note.trim().isNotEmpty)
              line(Icons.notes, 'Observação', note),
          ],
        ),
      ),
    ),
  );
}

Future<void> showMaterialHistoryEdit(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
  final actionLock = UiActionLock.acquire(context, 'showMaterialHistoryEdit');
  if (actionLock == null) return;
  try {
    final type = row['movement_type']?.toString() ?? 'entry';
    final qty = TextEditingController(text: row['quantity']?.toString() ?? '1');
    final note = TextEditingController(text: row['note']?.toString() ?? '');
    String? originId = row['origin_team_id']?.toString();
    String? destinationId = row['destination_team_id']?.toString();
    String? error;
    bool busy = false;

    try {
      await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Corrigir movimentação'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: qty,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Quantidade'),
                  ),
                  if (type == 'transfer' ||
                      type == 'exit' ||
                      type == 'maintenance') ...[
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: originId,
                      decoration:
                          const InputDecoration(labelText: 'Equipe de origem'),
                      items: teams
                          .map((t) => DropdownMenuItem(
                              value: t.id, child: Text(t.name)))
                          .toList(),
                      onChanged:
                          busy ? null : (v) => setLocal(() => originId = v),
                    ),
                  ],
                  if (type == 'transfer' ||
                      type == 'entry' ||
                      type == 'return') ...[
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: destinationId,
                      decoration:
                          const InputDecoration(labelText: 'Equipe de destino'),
                      items: teams
                          .map((t) => DropdownMenuItem(
                              value: t.id, child: Text(t.name)))
                          .toList(),
                      onChanged: busy
                          ? null
                          : (v) => setLocal(() => destinationId = v),
                    ),
                  ],
                  const SizedBox(height: 10),
                  TextField(
                    controller: note,
                    decoration: const InputDecoration(labelText: 'Observação'),
                  ),
                  if (error != null)
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        final q = int.tryParse(qty.text);
                        if (q == null || q <= 0) {
                          setLocal(() => error = 'Quantidade inválida.');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.updateMaterialHistory(
                            id: row['id'].toString(),
                            quantity: q,
                            originTeamId: originId,
                            destinationTeamId: destinationId,
                            note: note.text,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          setLocal(() => error = friendlyError(e));
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                child: const Text('Salvar correção'),
              ),
            ],
          ),
        ),
      );
    } finally {
      qty.dispose();
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}

Future<void> showAssetHistoryEdit(
  BuildContext context,
  MovementRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
  final actionLock = UiActionLock.acquire(context, 'showAssetHistoryEdit');
  if (actionLock == null) return;
  try {
    String? teamId = row['destination_team_id']?.toString();
    String status = row['new_status']?.toString() ?? 'available';
    final note = TextEditingController(text: row['note']?.toString() ?? '');
    bool busy = false;
    String? error;

    try {
      await showDialog(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (context, setLocal) => AlertDialog(
            title: const Text('Corrigir equipamento'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: teamId,
                  decoration:
                      const InputDecoration(labelText: 'Equipe correta'),
                  items: teams
                      .map((t) =>
                          DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => teamId = v),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: const [
                    DropdownMenuItem(
                        value: 'available', child: Text('Disponível')),
                    DropdownMenuItem(value: 'in_use', child: Text('Em uso')),
                    DropdownMenuItem(
                        value: 'maintenance', child: Text('Manutenção')),
                    DropdownMenuItem(
                        value: 'damaged', child: Text('Danificado')),
                    DropdownMenuItem(value: 'lost', child: Text('Perdido')),
                    DropdownMenuItem(value: 'retired', child: Text('Baixado')),
                  ],
                  onChanged: busy ? null : (v) => setLocal(() => status = v!),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: note,
                  decoration: const InputDecoration(labelText: 'Observação'),
                ),
                if (error != null)
                  Text(error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error)),
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(dialogContext),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        if (busy) return;
                        if (teamId == null) {
                          setLocal(() => error = 'Selecione a equipe.');
                          return;
                        }
                        setLocal(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await repo.updateAssetHistory(
                            id: row['id'].toString(),
                            destinationTeamId: teamId!,
                            status: status,
                            note: note.text,
                          );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext);
                          }
                        } catch (e) {
                          setLocal(() => error = friendlyError(e));
                        } finally {
                          if (dialogContext.mounted) {
                            setLocal(() => busy = false);
                          }
                        }
                      },
                child: const Text('Salvar correção'),
              ),
            ],
          ),
        ),
      );
    } finally {
      note.dispose();
    }
  } finally {
    actionLock.release();
  }
}
