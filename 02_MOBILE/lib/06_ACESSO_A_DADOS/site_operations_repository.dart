import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

String newOperationId() {
  final r = Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  final h = b.map((v) => v.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

List<Map<String, dynamic>> rowsOf(Map<String, dynamic> data, String key) =>
    (data[key] as List? ?? [])
        .map((row) => Map<String, dynamic>.from(row as Map))
        .toList();

class SiteOperationsRepository {
  SiteOperationsRepository(SupabaseClient client)
      : _currentUserId = (() => client.auth.currentUser?.id),
        _rpc = ((name, params) async => client.rpc(name, params: params));
  SiteOperationsRepository.withTransport({
    required String? Function() currentUserId,
    required Future<dynamic> Function(String, Map<String, dynamic>?) rpc,
  })  : _currentUserId = currentUserId,
        _rpc = rpc;
  final String? Function() _currentUserId;
  final Future<dynamic> Function(String, Map<String, dynamic>?) _rpc;
  static Future<void> _tail = Future<void>.value();
  String get _user =>
      _currentUserId() ?? (throw StateError('Entre na sua conta.'));
  String _key(String user) => 'metallo_operations_v1_$user';
  Future<T> _serial<T>(Future<T> Function() work) {
    final result = Completer<T>();
    _tail = _tail.then((_) async {
      try {
        result.complete(await work());
      } catch (e, st) {
        result.completeError(e, st);
      }
    });
    return result.future;
  }

  Future<Map<String, dynamic>> fetchSnapshot() async {
    final user = _user;
    final prefs = await SharedPreferences.getInstance();
    try {
      final raw = await _rpc('site_dashboard', null)
          .timeout(const Duration(seconds: 20));
      if (_user != user) throw StateError('A conta mudou.');
      final data = Map<String, dynamic>.from(raw as Map);
      await prefs.setString('${_key(user)}_snapshot', jsonEncode(data));
      return {...data, 'offline': false};
    } catch (_) {
      if (_currentUserId() != user) rethrow;
      final cached = prefs.getString('${_key(user)}_snapshot');
      if (cached == null) rethrow;
      return {
        ...Map<String, dynamic>.from(jsonDecode(cached) as Map),
        'offline': true
      };
    }
  }

  Future<List<Map<String, dynamic>>> pending() => _pendingFor(_user);

  Future<List<Map<String, dynamic>>> _pendingFor(String user) async {
    final prefs = await SharedPreferences.getInstance();
    final entries = (jsonDecode(prefs.getString(_key(user)) ?? '[]') as List)
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    if (entries.any((entry) =>
        entry['id'] is! String ||
        entry['command'] is! String ||
        DateTime.tryParse(entry['occurred_at']?.toString() ?? '') == null ||
        entry['data'] is! Map ||
        (entry['data'] as Map)['actor_id'] != user)) {
      throw StateError(
          'A fila local não pôde ser lida. Preserve os dados do aplicativo e contate a ADM.');
    }
    return entries;
  }

  Future<void> _save(String user, List<Map<String, dynamic>> values) async {
    final prefs = await SharedPreferences.getInstance();
    if (!await prefs.setString(_key(user), jsonEncode(values))) {
      throw StateError('Não foi possível guardar o lançamento no aparelho.');
    }
  }

  Future<String> submit(
          String command, Map<String, dynamic> data, DateTime occurredAt) =>
      _serial(() async {
        final user = _user;
        final entries = await _pendingFor(user);
        if (_user != user) {
          throw StateError('A conta mudou. Abra o formulário novamente.');
        }
        if (entries.length >= 200) {
          throw StateError(
              'Confira e envie os lançamentos pendentes antes de adicionar outros.');
        }
        if (occurredAt
                .isAfter(DateTime.now().add(const Duration(minutes: 5))) ||
            occurredAt.year < 2000) {
          throw StateError('Confira a data e a hora do fato.');
        }
        entries.add({
          'id': newOperationId(),
          'command': command,
          'data': {...data, 'actor_id': user},
          'occurred_at': occurredAt.toUtc().toIso8601String()
        });
        await _save(user, entries);
        return _sync(user, entries);
      });
  Future<String> sync() => _serial(() async {
        final user = _user;
        return _sync(user, await _pendingFor(user));
      });
  Future<String> _sync(String user, List<Map<String, dynamic>> entries) async {
    while (entries.isNotEmpty) {
      final entry = entries.first;
      try {
        if (_currentUserId() != user) {
          throw StateError('Entre novamente na mesma conta.');
        }
        await _rpc('run_site_operation', {
          'p_command': entry['command'],
          'p_data': entry['data'],
          'p_operation_id': entry['id'],
          'p_occurred_at': entry['occurred_at']
        }).timeout(const Duration(seconds: 20));
        entries.removeAt(0);
        await _save(user, entries);
      } catch (e) {
        entry['error'] = siteOperationError(e);
        await _save(user, entries);
        return '${entries.length} lançamento(s) guardado(s) no aparelho, aguardando confirmação. ${entry['error']}';
      }
    }
    return 'Lançamentos confirmados no Metallo.';
  }

  Future<void> removePending(String id) => _serial(() async {
        final user = _user;
        final entries = await _pendingFor(user);
        entries.removeWhere((row) => row['id'] == id);
        await _save(user, entries);
      });
}

String siteOperationError(Object error) {
  final message = error.toString();
  const known = {
    'worksite_required':
        'Peça à ADM para vincular a equipe a uma obra antes de registrar o estoque de EPI.',
    'same_worksite_stock': 'Origem e destino já usam o mesmo estoque de EPI.',
    'rental_already_registered':
        'Esta máquina já está registrada na empresa. Confira a locadora e a numeração.',
    'operation_actor_mismatch':
        'Entre novamente na conta que criou o lançamento.',
    'forbidden': 'Seu acesso não permite esta operação ou equipe.',
    'admin_required': 'Esta operação pertence à ADM.',
    'insufficient': 'Estoque insuficiente. Confira a quantidade.',
    'invalid_quantity':
        'A quantidade ultrapassa o saldo ou o que falta receber.',
    'invalid_order_transition': 'O pedido mudou de etapa. Atualize a consulta.',
    'order_not_receivable':
        'A ADM ainda não marcou a compra ou locação como providenciada.',
    'ca_required': 'Informe o C.A. do EPI recebido.',
    'wrong_worksite_stock': 'O lote pertence a outra obra.',
    'rental_identification_required':
        'Informe a locadora e um número para cada máquina recebida.',
    'unique': 'Já existe um registro com essa identificação.',
    'duplicate': 'Já existe um registro com essa identificação.',
    'stock_team_cannot_move':
        'A equipe do estoque principal não pode ser movida para outra obra.',
    'assignment_date_conflict':
        'As datas entram em conflito com uma alocação já registrada.',
    'invalid_variant': 'Escolha uma variante válida do item.',
  };
  for (final entry in known.entries) {
    if (message.contains(entry.key)) return entry.value;
  }
  return 'Confira a conexão e reenvie pela lista de pendentes. O estoque só muda após a confirmação.';
}

const siteCommandLabels = {
  'create_order': 'Pedido à ADM',
  'receive_order': 'Recebimento',
  'consume': 'Consumo',
  'material_entry': 'Entrada de material',
  'epi_entry': 'Entrada de EPI',
  'epi_transfer': 'Transferência de EPI',
  'transfer_equipment': 'Transferência de equipamento',
  'deliver_epi': 'Entrega de EPI',
  'create_worksite': 'Cadastro de obra',
  'link_team': 'Vínculo de equipe',
  'set_worksite_status': 'Situação da obra',
  'assign_employee': 'Funcionário em apoio',
  'end_assignment': 'Fim do apoio',
  'rental_notify': 'Aviso de devolução',
  'rental_resolve': 'Devolução de máquina',
  'order_status': 'Etapa do pedido',
  'rental_details': 'Dados da locação',
  'close_epi': 'Baixa de EPI'
};
