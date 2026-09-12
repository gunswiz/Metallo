import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:metallo/06_ACESSO_A_DADOS/site_operations_repository.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/user_access.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/epi_individual_pdf.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('sem internet mantém lançamento e reenvia o mesmo ID uma única vez',
      () async {
    var online = false;
    final sent = <String>[];
    final repo = SiteOperationsRepository.withTransport(
        currentUserId: () => 'user-a',
        rpc: (name, params) async {
          sent.add(params!['p_operation_id'] as String);
          final prefs = await SharedPreferences.getInstance();
          expect(prefs.getString('metallo_operations_v1_user-a'),
              contains(sent.last));
          if (!online) throw const SocketException('offline');
          return {};
        });
    await repo.submit('consume', {'quantity': 2}, DateTime.now());
    expect(await repo.pending(), hasLength(1));
    final originalId = (await repo.pending()).single['id'];
    online = true;
    await repo.sync();
    await repo.sync();
    expect(sent, [originalId, originalId]);
    expect(await repo.pending(), isEmpty);
  });

  test('trocar de conta não envia nem mostra pendências de outra pessoa',
      () async {
    var user = 'user-a';
    var online = false;
    final actors = <String>[];
    final repo = SiteOperationsRepository.withTransport(
        currentUserId: () => user,
        rpc: (name, params) async {
          if (!online) throw const SocketException('offline');
          actors.add(params!['p_data']['actor_id'] as String);
          return {};
        });
    await repo.submit('consume', {'quantity': 1}, DateTime.now());
    user = 'user-b';
    online = true;
    expect(await repo.pending(), isEmpty);
    await repo.sync();
    expect(actors, isEmpty);
    user = 'user-a';
    await repo.sync();
    expect(actors, ['user-a']);
  });

  test('erro de permissão conserva o registro para conferência', () async {
    final repo = SiteOperationsRepository.withTransport(
        currentUserId: () => 'a',
        rpc: (_, params) async => throw StateError('forbidden_team'));
    final message =
        await repo.submit('consume', {'quantity': 1}, DateTime.now());
    expect(message, contains('Seu acesso não permite'));
    expect(await repo.pending(), hasLength(1));
  });

  test(
      'cache permite consultar offline sem misturar usuários e fila inválida é preservada',
      () async {
    var online = true;
    var user = 'a';
    final repo = SiteOperationsRepository.withTransport(
        currentUserId: () => user,
        rpc: (_, params) async {
          if (!online) throw const SocketException('offline');
          return {
            'teams': [
              {'id': 'equipe', 'name': 'Teste'}
            ]
          };
        });
    await repo.fetchSnapshot();
    online = false;
    expect((await repo.fetchSnapshot())['offline'], true);
    user = 'b';
    await expectLater(repo.fetchSnapshot(), throwsA(isA<SocketException>()));
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('metallo_operations_v1_b', '[{"id":"incompleto"}]');
    await expectLater(
        repo.submit('consume', {}, DateTime.now()), throwsStateError);
    expect(prefs.getString('metallo_operations_v1_b'), '[{"id":"incompleto"}]');
  });

  test('permissão personalizada concede EPI sem virar administrador', () {
    final access = UserAccess.fromProfile({
      'role': 'collaborator',
      'active': true,
      'team_id': 'a',
      'operation_permissions': ['epi:write'],
      'operation_team_ids': ['a', 'b']
    });
    expect(access.canAt('epi:write', 'b'), true);
    expect(access.canAt('epi:write', 'c'), false);
    expect(access.can('materials:write'), false);
    expect(
        const UserAccess(role: 'admin', active: false).can('epi:write'), false);
  });

  test('PDF individual gera várias páginas e rejeita outro funcionário',
      () async {
    final person = {
      'id': 'employee',
      'full_name': 'Funcionário fictício para conferência do relatório',
      'profession': 'Soldador e montador de estruturas metálicas',
      'registration_code': 'TESTE-001'
    };
    final rows = List.generate(
        70,
        (index) => <String, dynamic>{
              'employee_id': 'employee',
              'delivered_at': '2026-09-01T12:00:00Z',
              'epi_items': {
                'name':
                    'Óculos de proteção e luvas de segurança para trabalho de montagem',
                'item_kind': 'epi'
              },
              'ca_snapshot': '12345',
              'quantity': 2,
              'variant_snapshot': 'Escuro / tamanho G'
            });
    final bytes = await buildIndividualEpiPdf(
        person: person, deliveries: rows, generatedBy: 'ADM de teste');
    expect(utf8.decode(bytes.take(5).toList()), '%PDF-');
    if (Platform.environment['METALLO_PDF_OUTPUT'] case final String output) {
      await Directory(output).create(recursive: true);
      await File('$output/epi-individual-mobile-exemplo.pdf')
          .writeAsBytes(bytes);
    }
    await expectLater(
        buildIndividualEpiPdf(
            person: person,
            deliveries: [
              {...rows.first, 'employee_id': 'other'}
            ],
            generatedBy: 'Teste'),
        throwsStateError);
  });
}
