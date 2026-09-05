import 'package:flutter/material.dart';

bool _isConnectivityError(Object? error) {
  final text = (error?.toString() ?? '').toLowerCase();
  return text.contains('socketexception') ||
      text.contains('failed host lookup') ||
      text.contains('handshakeexception') ||
      text.contains('handshake error') ||
      text.contains('certificate_verify_failed') ||
      text.contains('connection refused') ||
      text.contains('connection reset') ||
      text.contains('network is unreachable') ||
      text.contains('connection timed out') ||
      text.contains('timed out');
}

String friendlyError(Object? error) {
  final t = error.toString().replaceFirst('Exception: ', '');
  if (t.contains('email_not_confirmed') ||
      t.toLowerCase().contains('email not confirmed')) {
    return 'Seu cadastro foi criado, mas o e-mail ainda não foi confirmado. Confirme pelo link enviado ao seu e-mail e, depois, aguarde a liberação do administrador.';
  }
  if (t.contains('invalid_credentials') ||
      t.toLowerCase().contains('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (t.contains('user_already_exists') ||
      t.toLowerCase().contains('user already registered')) {
    return 'Já existe uma conta cadastrada com este e-mail.';
  }
  if (t.contains('weak_password')) {
    return 'A senha não atende aos requisitos configurados no servidor.';
  }
  if (t.contains('admin_required')) {
    return 'Apenas o administrador pode fazer isso.';
  }
  if (t.contains('forbidden_role')) {
    return 'Seu cargo não possui permissão para esta ação.';
  }
  if (t.contains('forbidden_team') || t.contains('forbidden_origin_team')) {
    return 'Você só pode operar a sua própria equipe.';
  }
  if (t.contains('team_has_inventory')) {
    return 'A equipe ainda possui materiais em estoque.';
  }
  if (t.contains('team_has_assets')) {
    return 'A equipe ainda possui equipamentos.';
  }
  if (t.contains('team_has_active_users')) {
    return 'A equipe ainda possui usuários ativos.';
  }
  if (t.contains('central_team_required')) {
    return 'A COSEM é a central obrigatória e não pode ser excluída.';
  }
  if (t.contains('team_has_epi_employees')) {
    return 'A equipe ainda possui funcionários ativos na gestão de EPI.';
  }
  if (t.contains('team_has_epi_requests')) {
    return 'A equipe ainda possui pendências de EPI abertas.';
  }
  if (t.contains('team_has_epi_deliveries')) {
    return 'A equipe ainda possui EPIs ou itens entregues em uso.';
  }
  if (t.contains('last_admin_required')) {
    return 'Não é possível remover o único administrador ativo. Ative outro administrador primeiro.';
  }
  if (t.contains('required_equipment_field')) {
    return 'Preencha o tipo, o código e o patrimônio do equipamento.';
  }
  if (t.contains('shoe_size_required')) {
    return 'Informe um número de bota válido, de 38 a 46, no cadastro do funcionário.';
  }
  if (t.contains('glasses_variant_required')) {
    return 'Escolha se o óculos de proteção é claro ou escuro.';
  }
  if (t.contains('only_latest_asset_movement_can_change')) {
    return 'Por segurança, somente a movimentação mais recente deste equipamento pode ser corrigida ou excluída.';
  }
  if (t.contains('cannot_reverse_destination_stock')) {
    return 'Não é possível desfazer este histórico porque o estoque atual já foi consumido ou transferido.';
  }
  if (t.contains('insufficient_stock')) {
    return 'Quantidade insuficiente na localização de origem.';
  }
  if (t.contains('item_has_stock')) {
    return 'Não é possível excluir: este material ainda possui saldo em uma localização.';
  }
  if (t.contains('item_has_assets')) {
    return 'Não é possível excluir: este cadastro ainda possui equipamentos ativos.';
  }
  if (t.contains('duplicate key') || t.contains('23505')) {
    return 'Este código ou patrimônio já está em uso.';
  }
  if (_isConnectivityError(error)) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  return t;
}

Future<bool?> confirm(BuildContext context, String title, String text) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Confirmar'),
        ),
      ],
    ),
  );
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(friendlyError(error))),
  );
}

bool isConnectivityError(Object? error) => _isConnectivityError(error);
