import 'package:flutter/material.dart';
import 'package:metallo/02_COMPONENTES/user_access_scope.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/user_access.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';
import 'operation_form.dart';
import 'order_composer.dart';

const orderStatusLabels = {
  'submitted': 'Enviado à ADM',
  'awaiting_owner': 'Aguardando o patrão',
  'approved': 'Aprovado',
  'ordered': 'Compra / locação providenciada',
  'partial': 'Recebimento parcial',
  'received': 'Recebido por completo',
  'rejected': 'Não aprovado',
  'cancelled': 'Cancelado',
  'pending': 'Aguardando a ADM',
  'arranged': 'Devolução combinada',
  'returned': 'Devolvido à locadora'
};
const transitions = {
  'submitted': ['awaiting_owner', 'rejected', 'cancelled'],
  'awaiting_owner': ['approved', 'rejected', 'cancelled'],
  'approved': ['ordered', 'cancelled'],
  'ordered': ['cancelled']
};

class SiteOperationsPage extends StatefulWidget {
  const SiteOperationsPage({super.key, required this.repo});
  final SiteOperationsRepository repo;
  @override
  State<SiteOperationsPage> createState() => _SiteOperationsPageState();
}

class _SiteOperationsPageState extends State<SiteOperationsPage>
    with WidgetsBindingObserver {
  late Future<Map<String, dynamic>> future = widget.repo.fetchSnapshot();
  String section = 'stock';
  bool syncing = false;
  String message = '';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) sync();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) sync();
  }

  void reload() {
    if (mounted) setState(() => future = widget.repo.fetchSnapshot());
  }

  Future<void> sync() async {
    if (syncing) return;
    setState(() => syncing = true);
    try {
      final text = await widget.repo.sync();
      if (mounted) setState(() => message = text);
      reload();
    } catch (e) {
      if (mounted) setState(() => message = siteOperationError(e));
    } finally {
      if (mounted) setState(() => syncing = false);
    }
  }

  Widget card(String title, List<Widget> children, {String? subtitle}) => Card(
      child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(title,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            if (subtitle != null) Text(subtitle),
            const SizedBox(height: 12),
            ...children
          ])));
  Widget operation(String title, String command, List<SiteField> fields,
          {Map<String, dynamic> fixed = const {}}) =>
      Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: OutlinedButton(
              onPressed: syncing
                  ? null
                  : () => showSiteOperation(context, widget.repo,
                      title: title,
                      command: command,
                      fields: fields,
                      fixed: fixed,
                      onSaved: reload),
              child: Text(title)));
  String date(dynamic value) {
    final d = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
    return d == null
        ? '-'
        : '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }

  final note =
      const SiteField('note', 'Observação', kind: 'textarea', required: false);
  final quantity =
      const SiteField('quantity', 'Quantidade', kind: 'number', value: '1');
  @override
  Widget build(BuildContext context) {
    final access = UserAccessScope.of(context);
    final admin = access.role == 'admin';
    return Scaffold(
        appBar: AppBar(title: const Text('Obras e pedidos'), actions: [
          IconButton(
              tooltip: 'Enviar pendentes e atualizar',
              onPressed: syncing ? null : sync,
              icon: const Icon(Icons.sync))
        ]),
        body: FutureBuilder<Map<String, dynamic>>(
            future: future,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(
                    child: Padding(
                        padding: const EdgeInsets.all(24),
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                          const Text(
                              'Não foi possível carregar. Conecte uma vez para guardar a consulta neste aparelho.'),
                          TextButton(
                              onPressed: reload,
                              child: const Text('Tentar novamente'))
                        ])));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final data = snapshot.data!,
                  teams = rowsOf(data, 'teams'),
                  works = rowsOf(data, 'works'),
                  materials = rowsOf(data, 'materials'),
                  epis = rowsOf(data, 'epi_items'),
                  batches = rowsOf(data, 'batches'),
                  employees = rowsOf(data, 'employees'),
                  assets = rowsOf(data, 'assets');
              String teamName(dynamic id) =>
                  teams
                      .where((t) => t['id'] == id)
                      .firstOrNull?['name']
                      ?.toString() ??
                  'Sem equipe';
              String workName(dynamic id) =>
                  works
                      .where((w) => w['id'] == id)
                      .firstOrNull?['name']
                      ?.toString() ??
                  'COSEM / central';
              final allowed = teams
                  .where((t) => access.allowsTeam(t['id'].toString()))
                  .toList();
              final teamField = SiteField(
                  'team_id', 'Equipe que executa o serviço',
                  options: allowed);
              final sections = {
                'stock': 'Estoque e lançamentos',
                'orders': 'Pedidos e recebimentos',
                'rentals': 'Máquinas alugadas',
                if (access.can('epi:write')) 'people': 'Funcionários em apoio',
                if (admin) ...{
                  'works': 'Obras e equipes',
                  'alerts': 'Alertas (${rowsOf(data, 'alerts').length})'
                }
              };
              final content = <Widget>[];
              if (section == 'stock') {
                for (final m in materials) {
                  for (final stock in rowsOf(m, 'stock')) {
                    content.add(card(
                        m['name'].toString(),
                        [
                          Text('${stock['quantity']} ${m['unit']}',
                              style: const TextStyle(
                                  fontSize: 22, fontWeight: FontWeight.bold))
                        ],
                        subtitle: works
                                .where((w) =>
                                    w['stock_team_id'] == stock['team_id'])
                                .firstOrNull?['name']
                                ?.toString() ??
                            teamName(stock['team_id'])));
                  }
                }
                if (access.can('consumption:write')) {
                  content.add(operation('Registrar consumo diário', 'consume', [
                    teamField,
                    SiteField('item_id', 'Material consumido',
                        options: materials),
                    quantity,
                    note
                  ]));
                }
                if (access.can('materials:write')) {
                  content.add(operation(
                      'Compra entregue direto na obra', 'material_entry', [
                    teamField,
                    SiteField('item_id', 'Material recebido',
                        options: materials),
                    quantity,
                    note
                  ]));
                }
                if (access.can('equipment:write')) {
                  content.add(operation(
                      'Transferir equipamento', 'transfer_equipment', [
                    SiteField('asset_id', 'Equipamento',
                        options: assets
                            .where((a) =>
                                a['active'] == true &&
                                access.allowsTeam(a['team_id']?.toString()))
                            .map((a) => {
                                  'id': a['id'],
                                  'name':
                                      '${a['name']} · ${a['code']} · ${teamName(a['team_id'])}'
                                })
                            .toList()),
                    SiteField('team_id', 'Equipe de destino', options: teams),
                    note
                  ]));
                }
                if (access.can('epi:write')) {
                  content.add(operation(
                      'Compra de EPI entregue direto na obra', 'epi_entry', [
                    teamField,
                    SiteField('item_id', 'Item recebido', options: epis),
                    quantity,
                    const SiteField('variant', 'Tamanho / variante do catálogo',
                        required: false),
                    const SiteField('ca_number', 'C.A. (obrigatório para EPI)',
                        required: false),
                    const SiteField('brand_model', 'Marca / modelo',
                        required: false),
                    const SiteField('lot_number', 'Lote', required: false)
                  ]));
                  content.add(operation(
                      'Transferir EPI da COSEM ou entre obras',
                      'epi_transfer', [
                    SiteField('stock_batch_id', 'Lote de origem',
                        options: batches
                            .map((b) => {
                                  'id': b['id'],
                                  'name':
                                      '${epis.where((i) => i['id'] == b['item_id']).firstOrNull?['name']} · ${workName(b['worksite_id'])} · CA ${b['ca_number'] ?? '-'} · ${b['quantity']} un'
                                })
                            .toList()),
                    teamField,
                    quantity
                  ]));
                  content.add(operation(
                      'Registrar entrega individual de EPI', 'deliver_epi', [
                    SiteField('employee_id', 'Funcionário', options: employees),
                    SiteField('delivery_batch', 'Item / lote / obra',
                        options: batches
                            .map((b) => {
                                  'id': '${b['id']}|${b['item_id']}',
                                  'name':
                                      '${epis.where((i) => i['id'] == b['item_id']).firstOrNull?['name']} · ${b['variant'] ?? 'Única'} · CA ${b['ca_number'] ?? '-'} · ${workName(b['worksite_id'])} · ${b['quantity']} un'
                                })
                            .toList()),
                    quantity,
                    SiteField('reason', 'Motivo', options: [
                      {'id': 'initial', 'name': 'Primeira entrega'},
                      {'id': 'additional', 'name': 'Adicional'},
                      {'id': 'wear', 'name': 'Desgaste'},
                      {'id': 'lost', 'name': 'Perda'},
                      {'id': 'damaged', 'name': 'Dano'}
                    ]),
                    note
                  ]));
                  for (final b in batches) {
                    content.add(card(
                        epis
                                .where((i) => i['id'] == b['item_id'])
                                .firstOrNull?['name']
                                ?.toString() ??
                            'EPI',
                        [
                          Text(
                              '${b['quantity']} un · ${b['variant'] ?? 'Única'} · C.A. ${b['ca_number'] ?? 'Não informado'}')
                        ],
                        subtitle: workName(b['worksite_id'])));
                  }
                }
              }
              if (section == 'orders') {
                if (access.can('requests:write') ||
                    access.can('rentals:write')) {
                  content.add(FilledButton.icon(
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => OrderComposer(
                                  repo: widget.repo,
                                  data: data,
                                  teams: allowed,
                                  canPurchase: access.can('requests:write'),
                                  canRent: access.can('rentals:write'),
                                  onSaved: reload))),
                      icon: const Icon(Icons.add),
                      label: const Text('Novo pedido à ADM')));
                }
                for (final order in rowsOf(data, 'orders')) {
                  final children = <Widget>[
                    Text(
                        'Solicitado: ${date(order['occurred_at'])}\nRegistrado: ${date(order['created_at'])}'),
                    if (order['note'] != null) Text(order['note'].toString())
                  ];
                  for (final line in rowsOf(order, 'lines')) {
                    final missing = (line['quantity'] as num) -
                        (line['received_quantity'] as num);
                    children.add(const Divider());
                    children.add(Text(
                        '${line['description']} ${line['variant'] ?? ''}',
                        style: const TextStyle(fontWeight: FontWeight.bold)));
                    children.add(Text(
                        'Pedido: ${line['quantity']} · Recebido: ${line['received_quantity']} · Falta: $missing'));
                    if (['ordered', 'partial'].contains(order['status']) &&
                        missing > 0 &&
                        access.can(line['kind'] == 'rental'
                            ? 'rentals:write'
                            : 'requests:write')) {
                      children.add(
                          operation('Confirmar o que chegou', 'receive_order', [
                        SiteField('quantity', 'Quantidade recebida',
                            kind: 'number', value: '1', max: missing.toInt()),
                        if (line['kind'] == 'epi') ...[
                          const SiteField(
                              'ca_number', 'C.A. (obrigatório para EPI)',
                              required: false),
                          const SiteField('brand_model', 'Marca / modelo',
                              required: false),
                          const SiteField('lot_number', 'Lote', required: false)
                        ],
                        if (line['kind'] == 'rental') ...[
                          const SiteField('rental_company', 'Locadora'),
                          const SiteField('asset_codes',
                              'Números das máquinas (um por linha)',
                              kind: 'textarea')
                        ],
                        note
                      ], fixed: {
                        'order_id': order['id'],
                        'line_id': line['id']
                      }));
                    }
                  }
                  if (admin && transitions.containsKey(order['status'])) {
                    children
                        .add(operation('ADM: atualizar etapa', 'order_status', [
                      SiteField('status', 'Nova etapa',
                          options: transitions[order['status']]!
                              .map((id) =>
                                  {'id': id, 'name': orderStatusLabels[id]})
                              .toList()),
                      note
                    ], fixed: {
                      'order_id': order['id']
                    }));
                  }
                  children.add(ExpansionTile(
                      title: const Text('Histórico do pedido'),
                      children: rowsOf(order, 'events')
                          .map((e) => ListTile(
                              title: Text(orderStatusLabels[e['event']] ??
                                  e['event'].toString()),
                              subtitle: Text(
                                  'Fato: ${date(e['occurred_at'])}\nLançamento: ${date(e['recorded_at'])}\n${e['quantity'] ?? ''} ${e['note'] ?? ''}')))
                          .toList()));
                  content.add(card(
                      '${teamName(order['team_id'])} · ${orderStatusLabels[order['status']]}',
                      children));
                }
              }
              if (section == 'rentals') {
                content.addAll(_rentalCards(data, access, teamName));
              }
              if (section == 'people') {
                for (final employee in employees) {
                  content.add(card(employee['name'].toString(), [
                    Text(
                        'Origem: ${teamName(employee['home_team_id'])}\nTrabalhando com: ${teamName(employee['team_id'])}')
                  ]));
                }
                if (admin) {
                  content.add(operation(
                      'Registrar funcionário em apoio', 'assign_employee', [
                    SiteField('employee_id', 'Funcionário', options: employees),
                    SiteField('team_id', 'Equipe em que vai ajudar',
                        options: teams),
                    const SiteField('ends_at', 'Fim previsto (opcional)',
                        kind: 'date', required: false),
                    note
                  ]));
                }
                for (final a in rowsOf(data, 'assignments').where((a) =>
                    a['ends_at'] == null ||
                    (DateTime.tryParse(a['ends_at'].toString())
                            ?.isAfter(DateTime.now()) ??
                        false))) {
                  content.add(card(
                      employees
                              .where((e) => e['id'] == a['employee_id'])
                              .firstOrNull?['name']
                              ?.toString() ??
                          'Funcionário',
                      [
                        Text(
                            '${teamName(a['team_id'])} · desde ${date(a['starts_at'])}'),
                        if (admin)
                          operation('Encerrar apoio e retornar à origem',
                              'end_assignment', [],
                              fixed: {'assignment_id': a['id']})
                      ]));
                }
              }
              if (section == 'works' && admin) {
                content.add(operation(
                    'Cadastrar obra e definir estoque', 'create_worksite', [
                  const SiteField('name', 'Nome da obra'),
                  SiteField('team_id', 'Equipe / local do estoque',
                      options: teams
                          .where((t) =>
                              t['worksite_id'] == null && t['central'] != true)
                          .toList())
                ]));
                content.add(
                    operation('Vincular mais uma equipe à obra', 'link_team', [
                  SiteField('worksite_id', 'Obra',
                      options:
                          works.where((w) => w['active'] == true).toList()),
                  SiteField('team_id', 'Equipe',
                      options: teams
                          .where((t) =>
                              !works.any((w) => w['stock_team_id'] == t['id']))
                          .toList())
                ]));
                content.add(const Text(
                    'Os saldos ainda separados da equipe serão somados ao estoque da obra, com registro no histórico.'));
                for (final w in works) {
                  content.add(card(w['name'].toString(), [
                    Text('Estoque: ${teamName(w['stock_team_id'])}'),
                    Text(w['active'] == true
                        ? 'Obra em andamento'
                        : 'Obra encerrada'),
                    operation(
                        w['active'] == true ? 'Encerrar obra' : 'Reabrir obra',
                        'set_worksite_status', [],
                        fixed: {
                          'worksite_id': w['id'],
                          'active': w['active'] != true
                        }),
                    Text(
                        'Equipes: ${teams.where((t) => t['worksite_id'] == w['id']).map((t) => t['name']).join(', ')}')
                  ]));
                }
              }
              if (section == 'alerts' && admin) {
                for (final alert in rowsOf(data, 'alerts')) {
                  content.add(Card(
                      child: ListTile(
                          leading: const Icon(Icons.notifications_active,
                              color: Colors.amber),
                          title: Text(alert['title'].toString()),
                          subtitle: Text(alert['description'].toString()),
                          onTap: () => setState(
                              () => section = alert['section'].toString()))));
                }
                if (content.isEmpty) {
                  content.add(const Text('Nenhuma pendência identificada.'));
                }
              }
              return ListView(padding: const EdgeInsets.all(16), children: [
                if (data['offline'] == true)
                  const Card(
                      child: Padding(
                          padding: EdgeInsets.all(14),
                          child: Text(
                              'Consulta salva no aparelho. Os saldos podem ter mudado. Novos lançamentos só alteram o estoque depois de enviados.'))),
                if (message.isNotEmpty) Text(message),
                FutureBuilder<List<Map<String, dynamic>>>(
                    future: widget.repo.pending(),
                    builder: (context, snap) {
                      if (snap.hasError) {
                        return const Text(
                            'Não foi possível ler os lançamentos pendentes. Preserve os dados do aplicativo e contate a ADM.');
                      }
                      final pending = snap.data ?? [];
                      if (pending.isEmpty) return const SizedBox.shrink();
                      return card(
                          '${pending.length} lançamento(s) pendente(s)', [
                        const Text(
                            'Guardados neste aparelho. Envie antes de apagar os dados do aplicativo.'),
                        for (final entry in pending)
                          ListTile(
                              title: Text(
                                  '${siteCommandLabels[entry['command']] ?? 'Lançamento'} · ${date(entry['occurred_at'])}'),
                              subtitle: Text(entry['error']?.toString() ??
                                  'Aguardando envio'),
                              trailing: IconButton(
                                  tooltip: 'Retirar da fila local',
                                  icon: const Icon(Icons.close),
                                  onPressed: syncing
                                      ? null
                                      : () async {
                                          await widget.repo.removePending(
                                              entry['id'].toString());
                                          reload();
                                        })),
                        FilledButton(
                            onPressed: syncing ? null : sync,
                            child: Text(
                                syncing ? 'Enviando…' : 'Enviar pendentes'))
                      ]);
                    }),
                SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                        children: sections.entries
                            .map((entry) => Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                    selectedColor: const Color(0xFF24505A),
                                    side: BorderSide(
                                        color: siteSectionColors[entry.key] ??
                                            Colors.blueAccent),
                                    label: Text(entry.value),
                                    selected: section == entry.key,
                                    onSelected: (_) =>
                                        setState(() => section = entry.key))))
                            .toList())),
                const SizedBox(height: 16),
                ...content,
              ]);
            }));
  }

  List<Widget> _rentalCards(Map<String, dynamic> data, UserAccess access,
      String Function(dynamic) teamName) {
    final cards = <Widget>[];
    final admin = access.role == 'admin';
    for (final asset
        in rowsOf(data, 'assets').where((a) => a['ownership'] == 'rented')) {
      final returns = rowsOf(data, 'rental_returns')
          .where((r) => r['asset_id'] == asset['id'])
          .toList();
      final details = rowsOf(data, 'rental_details')
          .where((r) => r['asset_id'] == asset['id'])
          .firstOrNull;
      final children = <Widget>[
        Text(
            '${asset['company']} · ${teamName(asset['team_id'])} · ${asset['active'] == true ? 'Na empresa' : 'Devolvida'}')
      ];
      if (asset['active'] == true &&
          access.canAt('rentals:write', asset['team_id']?.toString()) &&
          !returns.any((r) => ['pending', 'arranged'].contains(r['status']))) {
        children.add(operation(
            'Avisar à ADM: não precisamos mais', 'rental_notify', [
          const SiteField('note', 'Motivo / informação para a ADM',
              kind: 'textarea')
        ], fixed: {
          'asset_id': asset['id']
        }));
      }
      for (final r in returns) {
        children.add(Text('${orderStatusLabels[r['status']]} · ${r['note']}'));
        if (admin && ['pending', 'arranged'].contains(r['status'])) {
          children
              .add(operation('ADM: registrar providência', 'rental_resolve', [
            SiteField('status', 'Providência', options: [
              {'id': 'arranged', 'name': 'Devolução combinada'},
              {'id': 'returned', 'name': 'Entregue à locadora'},
              {'id': 'cancelled', 'name': 'Manter a máquina'}
            ]),
            note
          ], fixed: {
            'request_id': r['id']
          }));
        }
      }
      if (admin) {
        children.add(Text(
            'Valor: ${details?['amount'] ?? 'Não informado'}\nCobrança encerrada: ${details?['billing_closed_on'] ?? 'Não confirmada pela ADM'}'));
        children.add(
            operation('ADM: valores e datas da locação', 'rental_details', [
          SiteField('amount', 'Valor contratado (R\$)',
              kind: 'number',
              required: false,
              value: details?['amount']?.toString() ?? ''),
          SiteField('billing_period', 'Período da cobrança',
              required: false,
              value: details?['billing_period']?.toString() ?? '',
              options: [
                {'id': 'day', 'name': 'Diária'},
                {'id': 'week', 'name': 'Semanal'},
                {'id': 'month', 'name': 'Mensal'},
                {'id': 'contract', 'name': 'Contrato'}
              ]),
          SiteField('expected_return', 'Previsão de devolução',
              kind: 'date',
              required: false,
              value: details?['expected_return']?.toString() ?? ''),
          SiteField('billing_closed_on', 'Encerramento confirmado da cobrança',
              kind: 'date',
              required: false,
              value: details?['billing_closed_on']?.toString() ?? ''),
          SiteField('note', 'Observação',
              kind: 'textarea',
              required: false,
              value: details?['note']?.toString() ?? '')
        ], fixed: {
          'asset_id': asset['id']
        }));
        children.add(const Text(
            'Preencha somente informações confirmadas com a locadora. O aviso da obra não encerra a cobrança.'));
      }
      cards.add(card(
          '${asset['name']} · ${asset['number'] ?? asset['code']}', children));
    }
    return cards;
  }
}

const siteSectionColors = {
  'stock': Color(0xFF5EDBB5),
  'orders': Color(0xFF64CAFF),
  'rentals': Color(0xFFC6A0FF),
  'people': Color(0xFFE0D26D),
  'works': Color(0xFF64CAFF),
  'alerts': Color(0xFFFFAC6B)
};
