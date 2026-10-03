import 'package:flutter/material.dart';
import 'package:metallo/02_COMPONENTES/user_access_scope.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';
import 'operation_form.dart';

Future<void> showReceiveItems(BuildContext context, SiteOperationsRepository repo,
    {String? itemId, String kind = 'material', required VoidCallback onSaved}) async {
  try {
    final data = await repo.fetchSnapshot();
    if (!context.mounted) return;
    final access = UserAccessScope.of(context);
    final teams = rowsOf(data, 'teams').where((t) => access.allowsTeam(t['id'].toString())).toList();
    final source = await showModalBottomSheet<String>(context: context, showDragHandle: true,
      builder: (sheet) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const ListTile(title: Text('Receber itens'), subtitle: Text('Identifique a chegada para não registrar o estoque duas vezes.')),
        ListTile(leading: const Icon(Icons.receipt_long), title: const Text('Pedido já cadastrado'),
          onTap: () => Navigator.pop(sheet, 'order')),
        if (access.can(kind == 'epi' ? 'epi:write' : 'materials:write'))
          ListTile(leading: const Icon(Icons.add_box_outlined), title: const Text('Entrada sem pedido'),
            subtitle: const Text('Somente quando a chegada não corresponde a um pedido existente.'),
            onTap: () => Navigator.pop(sheet, 'direct')),
      ])));
    if (!context.mounted || source == null) return;
    const note = SiteField('note', 'Observação', kind: 'textarea', required: false);
    if (source == 'order') {
      final options = <Map<String, dynamic>>[];
      for (final order in rowsOf(data, 'orders')) {
        if (!['ordered', 'partial'].contains(order['status']) || !access.allowsTeam(order['team_id'].toString())) continue;
        for (final line in rowsOf(order, 'lines')) {
          if (!access.can(line['kind'] == 'rental' ? 'rentals:write' : 'requests:write')) continue;
          if ((line['quantity'] as num) > (line['received_quantity'] as num)) options.add({'order': order, 'line': line});
        }
      }
      final chosen = await showModalBottomSheet<Map<String, dynamic>>(context: context, showDragHandle: true,
        builder: (sheet) => SafeArea(child: ListView(shrinkWrap: true, children: [
          const ListTile(title: Text('O que chegou?')),
          if (options.isEmpty) const ListTile(title: Text('Nenhum item aguardando recebimento com seu acesso.')),
          for (final option in options) ListTile(
            title: Text((option['line'] as Map)['description'].toString()),
            subtitle: Text('Pedido: ' + (option['order'] as Map)['id'].toString().substring(0,8) +
              ' · recebido ' + (option['line'] as Map)['received_quantity'].toString() +
              ' de ' + (option['line'] as Map)['quantity'].toString()),
            onTap: () => Navigator.pop(sheet, option)),
        ])));
      if (!context.mounted || chosen == null) return;
      final order = chosen['order'] as Map, line = chosen['line'] as Map;
      await showSiteOperation(context, repo, title: 'Confirmar o que chegou', command: 'receive_order',
        fixed: {'order_id': order['id'], 'line_id': line['id']}, onSaved: onSaved, fields: [
          SiteField('quantity', 'Quantidade recebida', kind:'number', value:'1',
            max: (line['quantity'] as num).toInt() - (line['received_quantity'] as num).toInt()),
          if (line['kind'] == 'epi') ...[
            const SiteField('ca_number', 'C.A. (obrigatório para EPI)', required:false),
            const SiteField('brand_model', 'Marca / modelo', required:false),
            const SiteField('lot_number', 'Lote', required:false),
          ],
          if (line['kind'] == 'rental') ...[
            const SiteField('rental_company', 'Locadora'),
            const SiteField('asset_codes', 'Número de cada máquina, um por linha', kind:'textarea'),
          ], note,
        ]);
    } else {
      await showSiteOperation(context, repo, title: 'Entrada sem pedido', command: kind == 'epi' ? 'epi_entry' : 'material_entry',
        onSaved: onSaved, fields:[
          SiteField('team_id', 'Equipe / local que recebeu', options:teams),
          SiteField('item_id', 'Item recebido', value:itemId??'', options:rowsOf(data, kind == 'epi' ? 'epi_items' : 'materials')),
          const SiteField('quantity', 'Quantidade', kind:'number', value:'1'),
          if(kind == 'epi') ...[
            const SiteField('variant', 'Variante / tamanho', required:false),
            const SiteField('ca_number', 'C.A. (obrigatório para EPI)', required:false),
            const SiteField('brand_model', 'Marca / modelo', required:false),
            const SiteField('lot_number', 'Lote', required:false),
          ], note,
        ]);
    }
  } catch(error) {
    if(context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(siteOperationError(error))));
  }
}
