import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/features/epi/aso_date_picker.dart';
import 'package:metallo/shared/widgets/ui_action_lock.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_catalog.dart';

void openEmployeeDetails(BuildContext context, EpiRepository repo,
    AdminRepository adminRepository, Map<String, dynamic> person) {
  Navigator.push(
      context,
      MaterialPageRoute(
          builder: (_) => _EmployeeDetailsPage(
              repo: repo, adminRepository: adminRepository, person: person)));
}

class _EmployeeDetailsPage extends StatefulWidget {
  const _EmployeeDetailsPage(
      {required this.repo,
      required this.adminRepository,
      required this.person});
  final EpiRepository repo;
  final AdminRepository adminRepository;
  final Map<String, dynamic> person;

  @override
  State<_EmployeeDetailsPage> createState() => _EmployeeDetailsPageState();
}

class _EmployeeDetailsPageState extends State<_EmployeeDetailsPage> {
  late Future<List<dynamic>> future = _load();

  Future<List<dynamic>> _load() => Future.wait<dynamic>([
        widget.repo.fetchEpiDeliveries(),
        widget.repo.fetchEpiItems(),
        widget.repo.fetchEpiRequests(),
        widget.repo.fetchEpiEmployeeItemSet(widget.person['id'].toString()),
      ]);

  void reload() => setState(() => future = _load());

  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: AppBar(title: const Text('Funcionário')),
          body: Column(children: [
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: epiCardColor,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: metalloEpiBorder)),
              child: Row(children: [
                const CircleAvatar(
                    radius: 32,
                    backgroundColor: metalloEpiIconBackground,
                    child:
                        Icon(Icons.person_outline, color: epiBlue, size: 35)),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(
                          widget.person['full_name']?.toString() ??
                              'Funcionário',
                          style: const TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w900)),
                      Text(
                          '${widget.person['profession']} • ${(widget.person['teams'] as Map?)?['name'] ?? 'Sem equipe'}',
                          style: const TextStyle(color: Colors.white60)),
                      Text(
                          'Farda ${widget.person['shirt_size'] ?? '-'} • Calçado ${widget.person['shoe_size'] ?? '-'}',
                          style: const TextStyle(
                              color: Color(0xFF75BBFF), fontSize: 12)),
                    ]))
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: _AsoCard(
                  repo: widget.repo,
                  adminRepository: widget.adminRepository,
                  person: widget.person,
                  onChanged: () => setState(() {})),
            ),
            const TabBar(tabs: [
              Tab(text: 'EPI'),
              Tab(text: 'Fardamento'),
              Tab(text: 'Itens pessoais')
            ]),
            Expanded(
                child: FutureBuilder<List<dynamic>>(
              future: future,
              builder: (context, snap) {
                if (snap.hasError) return EpiModuleError(onRetry: reload);
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final rows = (snap.data![0] as List<Map<String, dynamic>>)
                    .where((d) =>
                        d['employee_id']?.toString() ==
                        widget.person['id']?.toString())
                    .toList();
                final items = snap.data![1] as List<Map<String, dynamic>>;
                final requests = (snap.data![2] as List<Map<String, dynamic>>)
                    .where((r) =>
                        r['employee_id']?.toString() ==
                        widget.person['id']?.toString())
                    .toList();
                final itemSet = Map<String, dynamic>.from(snap.data![3] as Map);
                final customItems = itemSet['configured'] == true
                    ? List<Map<String, dynamic>>.from(itemSet['rows'] as List)
                    : null;
                return TabBarView(children: [
                  _AssignmentList(
                      kind: 'epi',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                  _AssignmentList(
                      kind: 'uniform',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                  _AssignmentList(
                      kind: 'personal_tool',
                      profession: widget.person['profession']?.toString() ?? '',
                      rows: rows,
                      items: items,
                      requests: requests,
                      person: widget.person,
                      customItems: customItems,
                      repo: widget.repo,
                      onChanged: reload),
                ]);
              },
            )),
          ]),
        ),
      );
}

String asoStatusLabel(Map<String, dynamic> person) {
  final expiry = DateTime.tryParse(person['aso_expiry_date']?.toString() ?? '');
  if (expiry == null) return 'ASO não informado • cadastrar validade';
  final now = DateTime.now();
  final days = expiry.difference(DateTime(now.year, now.month, now.day)).inDays;
  final date =
      '${expiry.day.toString().padLeft(2, '0')}/${expiry.month.toString().padLeft(2, '0')}/${expiry.year}';
  if (days < 0) return 'ASO vencido em $date • renovar';
  if (days <= 30) return 'ASO vence em $date • renovar em breve';
  return 'ASO válido até $date';
}

class _AsoCard extends StatelessWidget {
  const _AsoCard(
      {required this.repo,
      required this.adminRepository,
      required this.person,
      required this.onChanged});
  final EpiRepository repo;
  final AdminRepository adminRepository;
  final Map<String, dynamic> person;
  final VoidCallback onChanged;

  Future<void> _renew(BuildContext context) async {
    final actionLock = UiActionLock.acquire(context, '_renew');
    if (actionLock == null) return;
    try {
      final profile = await adminRepository.currentProfile();
      if (!context.mounted) return;
      if (profile?['role'] != 'admin') {
        showEpiMessage(context,
            'Solicite ao administrador o registro da renovação do ASO.');
        return;
      }
      final now = DateTime.now();
      final exam = await showAsoDatePicker(
        context,
        helpText: 'Data do exame ASO',
        initialDate: now,
        firstDate: DateTime(2000),
        lastDate: now,
      );
      if (exam == null || !context.mounted) return;
      final expiry = await showAsoDatePicker(
        context,
        helpText: 'Validade informada para o ASO',
        initialDate: now,
        firstDate: exam,
        lastDate: DateTime(now.year + 10),
      );
      if (expiry == null || !context.mounted) return;
      try {
        await repo.renewEmployeeAso(person['id'].toString(), exam, expiry);
        person['aso_exam_date'] = exam.toIso8601String().substring(0, 10);
        person['aso_expiry_date'] = expiry.toIso8601String().substring(0, 10);
        onChanged();
        if (context.mounted) showEpiMessage(context, 'ASO atualizado.');
      } catch (_) {
        if (context.mounted) {
          showEpiMessage(context, 'Não foi possível atualizar o ASO.');
        }
      }
    } finally {
      actionLock.release();
    }
  }

  @override
  Widget build(BuildContext context) {
    final expiry =
        DateTime.tryParse(person['aso_expiry_date']?.toString() ?? '');
    final alert = expiry == null ||
        expiry.isBefore(DateTime.now().add(const Duration(days: 31)));
    final color = alert ? Colors.orangeAccent : Colors.greenAccent;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: color.withValues(alpha: .1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: .5))),
      child: Row(children: [
        Icon(Icons.medical_information_outlined, color: color),
        const SizedBox(width: 10),
        Expanded(
            child: Text(asoStatusLabel(person),
                style: TextStyle(color: color, fontWeight: FontWeight.w800))),
        TextButton(
            onPressed: () => _renew(context),
            child: Text(expiry == null ? 'Cadastrar' : 'Renovar')),
      ]),
    );
  }
}

class _AssignmentList extends StatelessWidget {
  const _AssignmentList(
      {required this.kind,
      required this.profession,
      required this.rows,
      required this.items,
      required this.requests,
      required this.person,
      required this.customItems,
      required this.repo,
      required this.onChanged});
  final String kind, profession;
  final List<Map<String, dynamic>> rows;
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> requests;
  final Map<String, dynamic> person;
  final List<Map<String, dynamic>>? customItems;
  final EpiRepository repo;
  final VoidCallback onChanged;
  @override
  Widget build(BuildContext context) {
    final delivered = rows
        .where((r) =>
            (r['epi_items'] as Map?)?['item_kind'] == kind &&
            r['current_status'] == 'active')
        .toList();
    final recommended = customItems == null
        ? recommendedEpiCodes(profession, kind)
        : customItems!
            .map((row) {
              final item = items
                  .where((i) => i['id'].toString() == row['item_id'].toString())
                  .firstOrNull;
              if (item == null || item['item_kind'] != kind) return null;
              return (
                item['code'].toString(),
                (row['required_quantity'] as num?)?.toInt() ?? 1
              );
            })
            .whereType<(String, int)>()
            .toList();
    return ListView(padding: const EdgeInsets.all(16), children: [
      for (final rec in recommended)
        if (items.where((i) => i['code'] == rec.$1).firstOrNull
            case final item?)
          Builder(builder: (context) {
            final itemId = item['id'].toString();
            final itemDeliveries = delivered
                .where((r) => r['item_id']?.toString() == itemId)
                .toList();
            final deliveredQty = itemDeliveries.fold<int>(
                0, (sum, r) => sum + ((r['quantity'] as num?)?.toInt() ?? 0));
            final variants = itemDeliveries
                .map((r) => r['variant_snapshot']?.toString().trim())
                .whereType<String>()
                .where((value) => value.isNotEmpty)
                .toSet();
            final variantDetail = variants.isEmpty
                ? null
                : item['code'] == 'EPI-BOT'
                    ? 'Número ${variants.join(', ')}'
                    : variants.join(', ');
            final pendingRequest = requests
                .where((r) =>
                    r['item_id']?.toString() == itemId &&
                    r['status'] == 'pending')
                .firstOrNull;
            final pending = pendingRequest != null;
            final pendingVariant =
                pendingRequest?['requested_variant']?.toString();
            return _assignmentCard(item['name']?.toString() ?? 'Item',
                '$deliveredQty/${rec.$2}', deliveredQty >= rec.$2, null,
                detail: variantDetail ??
                    (pendingVariant == null
                        ? null
                        : 'Solicitado: $pendingVariant • aguardando COSEM'),
                pending: pending,
                onTap: deliveredQty >= rec.$2 || pending
                    ? null
                    : () => _request(context, item, rec.$2 - deliveredQty));
          }),
      for (final row in delivered.where((r) =>
          !recommended.any((x) => x.$1 == (r['epi_items'] as Map?)?['code'])))
        _assignmentCard(
            (row['epi_items'] as Map?)?['name']?.toString() ?? 'Item',
            '${row['quantity']} ${(row['epi_items'] as Map?)?['unit'] ?? 'un'}',
            true,
            row['ca_snapshot']?.toString(),
            detail: row['variant_snapshot'] == null
                ? null
                : '${(row['epi_items'] as Map?)?['code'] == 'EPI-BOT' ? 'Número ' : ''}${row['variant_snapshot']}'),
      if (recommended.isEmpty && delivered.isEmpty)
        const Center(
            child: Padding(
                padding: EdgeInsets.all(30),
                child: Text('Nenhum item previsto para esta função.'))),
    ]);
  }

  Future<void> _request(
      BuildContext context, Map<String, dynamic> item, int quantity) async {
    final actionLock = UiActionLock.acquire(context, '_request');
    if (actionLock == null) return;
    try {
      final teamId = person['team_id']?.toString();
      if (teamId == null) {
        showEpiMessage(context, 'Associe o funcionário a uma equipe primeiro.');
        return;
      }
      String? requestedVariant;
      if (item['code'] == 'EPI-OCU') {
        bool variantChosen = false;
        void chooseVariant(BuildContext sheetContext, String variant) {
          if (variantChosen) return;
          variantChosen = true;
          Navigator.pop(sheetContext, variant);
        }

        requestedVariant = await showModalBottomSheet<String>(
          context: context,
          showDragHandle: true,
          builder: (sheetContext) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('Qual óculos deve ser solicitado?',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                ListTile(
                  leading:
                      const Icon(Icons.light_mode_outlined, color: epiBlue),
                  title: const Text('Óculos claro'),
                  onTap: () => chooseVariant(sheetContext, 'Claro'),
                ),
                ListTile(
                  leading: const Icon(Icons.dark_mode_outlined, color: epiBlue),
                  title: const Text('Óculos escuro'),
                  onTap: () => chooseVariant(sheetContext, 'Escuro'),
                ),
              ]),
            ),
          ),
        );
        if (requestedVariant == null) return;
      }
      try {
        await repo.requestEpiItem(
            employeeId: person['id'].toString(),
            teamId: teamId,
            itemId: item['id'].toString(),
            quantity: quantity,
            requestedVariant: requestedVariant);
        if (context.mounted) {
          showEpiMessage(context, 'Solicitação enviada para a COSEM.');
          onChanged();
        }
      } catch (_) {
        if (context.mounted) {
          showEpiMessage(context, 'Esta pendência já foi solicitada.');
        }
      }
    } finally {
      actionLock.release();
    }
  }

  Widget _assignmentCard(String name, String qty, bool ok, String? ca,
          {String? detail, bool pending = false, VoidCallback? onTap}) =>
      Card(
          color: epiCardColor,
          child: ListTile(
            onTap: onTap,
            leading: Icon(
                ok
                    ? Icons.check_circle
                    : pending
                        ? Icons.schedule_rounded
                        : Icons.warning_amber_rounded,
                color: ok
                    ? Colors.greenAccent
                    : pending
                        ? epiBlue
                        : Colors.orangeAccent),
            title:
                Text(name, style: const TextStyle(fontWeight: FontWeight.w800)),
            subtitle: Text(detail ??
                (ca == null
                    ? (ok
                        ? 'Entregue'
                        : pending
                            ? 'Solicitação enviada • aguardando COSEM'
                            : 'Pendente • toque para solicitar')
                    : 'CA $ca')),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: (ok
                        ? Colors.greenAccent
                        : pending
                            ? epiBlue
                            : Colors.orangeAccent)
                    .withValues(alpha: .12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(qty,
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: ok
                          ? Colors.greenAccent
                          : pending
                              ? epiBlue
                              : Colors.orangeAccent)),
            ),
          ));
}

Widget epiDeliveryDetail(IconData icon, String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 7),
    child: Row(children: [
      Icon(icon, color: epiBlue),
      const SizedBox(width: 12),
      Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(color: Colors.white54, fontSize: 12)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700))
      ]))
    ]));
