import 'package:flutter/material.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';

class SiteField {
  const SiteField(this.key, this.label,
      {this.options,
      this.kind = 'text',
      this.required = true,
      this.value = '',
      this.max = 100000});
  final String key, label, kind, value;
  final bool required;
  final int max;
  final List<Map<String, dynamic>>? options;
}

Future<void> showSiteOperation(
    BuildContext context, SiteOperationsRepository repo,
    {required String title,
    required String command,
    required List<SiteField> fields,
    Map<String, dynamic> fixed = const {},
    required VoidCallback onSaved}) async {
  await Navigator.push(
      context,
      MaterialPageRoute(
          builder: (_) => _OperationPage(
              repo: repo,
              title: title,
              command: command,
              fields: fields,
              fixed: fixed,
              onSaved: onSaved)));
}

class _OperationPage extends StatefulWidget {
  const _OperationPage(
      {required this.repo,
      required this.title,
      required this.command,
      required this.fields,
      required this.fixed,
      required this.onSaved});
  final SiteOperationsRepository repo;
  final String title, command;
  final List<SiteField> fields;
  final Map<String, dynamic> fixed;
  final VoidCallback onSaved;
  @override
  State<_OperationPage> createState() => _OperationPageState();
}

class _OperationPageState extends State<_OperationPage> {
  final _form = GlobalKey<FormState>();
  late final controllers = {
    for (final f in widget.fields) f.key: TextEditingController(text: f.value)
  };
  bool busy = false;
  String? error;
  DateTime occurred = DateTime.now();
  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> pickTime() async {
    final date = await showDatePicker(
        context: context,
        initialDate: occurred,
        firstDate: DateTime(2000),
        lastDate: DateTime.now());
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: TimeOfDay.fromDateTime(occurred));
    if (time != null && mounted) {
      setState(() => occurred =
          DateTime(date.year, date.month, date.day, time.hour, time.minute));
    }
  }

  Future<void> save() async {
    if (busy || !_form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final values = <String, dynamic>{...widget.fixed};
      for (final f in widget.fields) {
        final text = controllers[f.key]!.text.trim();
        values[f.key] = f.kind == 'number' && text.isNotEmpty
            ? num.parse(text.replaceAll(',', '.'))
            : text;
      }
      if (values.containsKey('asset_codes')) {
        values['asset_codes'] = values['asset_codes']
            .toString()
            .split(RegExp(r'[\n,;]+'))
            .map((s) => s.trim())
            .where((s) => s.isNotEmpty)
            .toList();
      }
      if (values.containsKey('delivery_batch')) {
        final parts = values.remove('delivery_batch').toString().split('|');
        values['lines'] = [
          {
            'stock_batch_id': parts[0],
            'item_id': parts[1],
            'quantity': values.remove('quantity')
          }
        ];
      }
      if (values['ends_at'] != null && values['ends_at'] != '') {
        values['ends_at'] = '${values['ends_at']}T23:59:59-03:00';
      }
      final message =
          await widget.repo.submit(widget.command, values, occurred);
      widget.onSaved();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => error =
            e is StateError ? e.message.toString() : siteOperationError(e));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(18), children: [
            for (final f in widget.fields)
              Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: f.options != null
                      ? DropdownButtonFormField<String>(
                          initialValue: f.value.isEmpty ? null : f.value,
                          isExpanded: true,
                          decoration: InputDecoration(labelText: f.label),
                          items: [
                            if (!f.required)
                              const DropdownMenuItem(
                                  value: '', child: Text('Não informado')),
                            for (final o in f.options!)
                              DropdownMenuItem(
                                  value: o['id'].toString(),
                                  child: Text(o['name'].toString(),
                                      overflow: TextOverflow.ellipsis))
                          ],
                          onChanged: busy
                              ? null
                              : (value) =>
                                  controllers[f.key]!.text = value ?? '',
                          validator: (value) =>
                              f.required && (value == null || value.isEmpty)
                                  ? 'Selecione uma opção.'
                                  : null)
                      : TextFormField(
                          controller: controllers[f.key],
                          enabled: !busy,
                          readOnly: f.kind == 'date',
                          maxLines: f.kind == 'textarea' ? 3 : 1,
                          decoration: InputDecoration(
                              labelText: f.label,
                              suffixIcon: f.kind == 'date'
                                  ? IconButton(
                                      icon: const Icon(Icons.calendar_month),
                                      onPressed: busy
                                          ? null
                                          : () async {
                                              final d = await showDatePicker(
                                                  context: context,
                                                  initialDate:
                                                      DateTime.tryParse(
                                                              controllers[
                                                                      f.key]!
                                                                  .text) ??
                                                          DateTime.now(),
                                                  firstDate: DateTime(2000),
                                                  lastDate: DateTime(2100));
                                              if (d != null) {
                                                controllers[f.key]!.text =
                                                    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
                                              }
                                            })
                                  : null),
                          keyboardType: f.kind == 'number'
                              ? const TextInputType.numberWithOptions(
                                  decimal: true)
                              : TextInputType.text,
                          validator: (value) {
                            if (f.required && (value ?? '').trim().isEmpty) {
                              return 'Preencha este campo.';
                            }
                            if (f.kind == 'number' &&
                                (value ?? '').isNotEmpty) {
                              final n =
                                  num.tryParse(value!.replaceAll(',', '.'));
                              if (n == null || n < 0 || n > f.max) {
                                return 'Confira a quantidade ou valor.';
                              }
                              if (f.key != 'amount' && n != n.truncate()) {
                                return 'Use uma quantidade inteira.';
                              }
                            }
                            return null;
                          })),
            ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Quando aconteceu?'),
                subtitle: Text(
                    '${occurred.day}/${occurred.month}/${occurred.year} ${occurred.hour.toString().padLeft(2, '0')}:${occurred.minute.toString().padLeft(2, '0')} · horário do aparelho'),
                trailing: const Icon(Icons.edit_calendar),
                onTap: busy ? null : pickTime),
            const Text(
                'Se estiver lançando depois, ajuste o horário do fato. O Metallo guarda também quando o registro foi enviado.'),
            if (error != null)
              Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error))),
            const SizedBox(height: 20),
            FilledButton(
                onPressed: busy ? null : save,
                child: Text(busy ? 'Guardando e enviando…' : 'Registrar')),
          ])));
}
