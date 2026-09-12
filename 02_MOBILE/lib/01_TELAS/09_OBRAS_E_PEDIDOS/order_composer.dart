import 'package:flutter/material.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';

class OrderComposer extends StatefulWidget {
  const OrderComposer(
      {super.key,
      required this.repo,
      required this.data,
      required this.teams,
      required this.canPurchase,
      required this.canRent,
      required this.onSaved});
  final SiteOperationsRepository repo;
  final Map<String, dynamic> data;
  final List<Map<String, dynamic>> teams;
  final bool canPurchase, canRent;
  final VoidCallback onSaved;
  @override
  State<OrderComposer> createState() => _OrderComposerState();
}

class _OrderComposerState extends State<OrderComposer> {
  late String kind = widget.canPurchase ? 'material' : 'rental';
  String? item, team;
  final quantity = TextEditingController(text: '1'),
      description = TextEditingController(),
      variant = TextEditingController(),
      note = TextEditingController();
  final lines = <Map<String, dynamic>>[];
  bool busy = false;
  String? error;
  DateTime occurred = DateTime.now();
  @override
  void dispose() {
    for (final c in [quantity, description, variant, note]) {
      c.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> get choices => kind == 'material'
      ? rowsOf(widget.data, 'materials')
      : kind == 'epi'
          ? rowsOf(widget.data, 'epi_items')
          : [];
  void add() {
    if (busy) return;
    final n = int.tryParse(quantity.text);
    final selected = choices.where((c) => c['id'] == item).firstOrNull;
    final name = kind == 'rental'
        ? description.text.trim()
        : selected?['name']?.toString();
    final variants = (selected?['variants'] as List?) ?? [];
    if (n == null ||
        n < 1 ||
        n > 100000 ||
        name == null ||
        name.isEmpty ||
        lines.length >= 100 ||
        (variants.isNotEmpty && !variants.contains(variant.text))) {
      setState(() => error = 'Confira o item, a quantidade e a variante.');
      return;
    }
    setState(() {
      lines.add({
        'kind': kind,
        'description': name,
        'quantity': n,
        'variant': variant.text.trim(),
        if (kind == 'material') 'item_id': item,
        if (kind == 'epi') 'epi_item_id': item
      });
      error = null;
    });
  }

  Future<void> send() async {
    if (busy || lines.isEmpty) return;
    if (team == null) {
      setState(() => error = 'Selecione a equipe solicitante.');
      return;
    }
    setState(() => busy = true);
    try {
      final message = await widget.repo.submit(
          'create_order',
          {
            'team_id': team,
            'lines': List<Map<String, dynamic>>.from(lines),
            'note': note.text.trim()
          },
          occurred);
      widget.onSaved();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) setState(() => error = siteOperationError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> pickTime() async {
    final day = await showDatePicker(
        context: context,
        initialDate: occurred,
        firstDate: DateTime(2000),
        lastDate: DateTime.now());
    if (day == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: TimeOfDay.fromDateTime(occurred));
    if (time != null && mounted) {
      setState(() => occurred =
          DateTime(day.year, day.month, day.day, time.hour, time.minute));
    }
  }

  @override
  Widget build(BuildContext context) {
    final variants = (choices
            .where((c) => c['id'] == item)
            .firstOrNull?['variants'] as List?) ??
        [];
    return Scaffold(
        appBar: AppBar(title: const Text('Novo pedido à ADM')),
        body: ListView(padding: const EdgeInsets.all(18), children: [
          DropdownButtonFormField<String>(
              initialValue: kind,
              decoration: const InputDecoration(labelText: 'Tipo de item'),
              items: [
                if (widget.canPurchase) ...[
                  const DropdownMenuItem(
                      value: 'material', child: Text('Material')),
                  const DropdownMenuItem(
                      value: 'epi',
                      child: Text('EPI / fardamento / item pessoal'))
                ],
                if (widget.canRent)
                  const DropdownMenuItem(
                      value: 'rental', child: Text('Máquina alugada'))
              ],
              onChanged: busy
                  ? null
                  : (v) => setState(() {
                        kind = v!;
                        item = null;
                        variant.clear();
                      })),
          const SizedBox(height: 14),
          if (kind == 'rental')
            TextField(
                controller: description,
                enabled: !busy,
                maxLength: 180,
                decoration:
                    const InputDecoration(labelText: 'Máquina necessária'))
          else
            DropdownButtonFormField<String>(
                key: ValueKey(kind),
                isExpanded: true,
                initialValue: item,
                decoration: const InputDecoration(labelText: 'Item'),
                items: choices
                    .map((c) => DropdownMenuItem(
                        value: c['id'].toString(),
                        child: Text(c['name'].toString(),
                            overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged: busy
                    ? null
                    : (v) => setState(() {
                          item = v;
                          variant.clear();
                        })),
          const SizedBox(height: 14),
          if (variants.isNotEmpty)
            DropdownButtonFormField<String>(
                key: ValueKey(item),
                decoration:
                    const InputDecoration(labelText: 'Tamanho / variante'),
                items: variants
                    .map((v) => DropdownMenuItem(
                        value: v.toString(), child: Text(v.toString())))
                    .toList(),
                onChanged: busy ? null : (v) => variant.text = v ?? '')
          else
            TextField(
                controller: variant,
                enabled: !busy,
                decoration: const InputDecoration(
                    labelText: 'Tamanho / variante (se houver)')),
          const SizedBox(height: 14),
          TextField(
              controller: quantity,
              enabled: !busy,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Quantidade')),
          const SizedBox(height: 10),
          OutlinedButton.icon(
              onPressed: busy ? null : add,
              icon: const Icon(Icons.add),
              label: const Text('Adicionar à lista')),
          for (var i = 0; i < lines.length; i++)
            ListTile(
                title: Text(
                    '${lines[i]['quantity']} × ${lines[i]['description']}'),
                subtitle: Text(lines[i]['variant'].toString()),
                trailing: IconButton(
                    icon: const Icon(Icons.close),
                    onPressed:
                        busy ? null : () => setState(() => lines.removeAt(i)))),
          const Divider(),
          DropdownButtonFormField<String>(
              initialValue: team,
              isExpanded: true,
              decoration:
                  const InputDecoration(labelText: 'Equipe solicitante'),
              items: widget.teams
                  .map((t) => DropdownMenuItem(
                      value: t['id'].toString(),
                      child: Text(t['name'].toString(),
                          overflow: TextOverflow.ellipsis)))
                  .toList(),
              onChanged: busy ? null : (v) => team = v),
          const SizedBox(height: 14),
          TextField(
              controller: note,
              enabled: !busy,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Observação')),
          ListTile(
              title: const Text('Quando foi solicitado?'),
              subtitle: Text(
                  '${occurred.day}/${occurred.month}/${occurred.year} ${occurred.hour}:${occurred.minute.toString().padLeft(2, '0')}'),
              trailing: const Icon(Icons.edit_calendar),
              onTap: busy ? null : pickTime),
          if (error != null)
            Text(error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          FilledButton(
              onPressed: busy || lines.isEmpty ? null : send,
              child:
                  Text(busy ? 'Guardando e enviando…' : 'Enviar pedido à ADM')),
        ]));
  }
}
