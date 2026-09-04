import '../data/models/team.dart';

String removePortugueseAccents(String value) => value
    .replaceAll('á', 'a')
    .replaceAll('ã', 'a')
    .replaceAll('â', 'a')
    .replaceAll('é', 'e')
    .replaceAll('ê', 'e')
    .replaceAll('í', 'i')
    .replaceAll('ó', 'o')
    .replaceAll('ô', 'o')
    .replaceAll('õ', 'o')
    .replaceAll('ú', 'u')
    .replaceAll('ç', 'c');

Team? findTeam(List<Team> teams, String id) {
  for (final t in teams) {
    if (t.id == id) return t;
  }
  return null;
}

String firstName(String name) {
  final clean = name.trim();
  return clean.isEmpty ? 'Usuário' : clean.split(RegExp(r'\s+')).first;
}

String roleLabel(String role) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'engineer':
      return 'Engenheiro';
    case 'leader':
      return 'Encarregado';
    default:
      return 'Colaborador';
  }
}

String statusLabel(String status) {
  const labels = {
    'available': 'Disponível',
    'in_use': 'Em uso',
    'maintenance': 'Manutenção',
    'damaged': 'Danificado',
    'lost': 'Perdido',
    'retired': 'Baixado',
  };
  return labels[status] ?? status;
}

String movementLabel(String type) {
  const labels = {
    'entry': 'Entrada',
    'exit': 'Saída',
    'transfer': 'Transferência',
    'return': 'Retorno',
    'maintenance': 'Manutenção',
    'assign': 'Atribuição',
    'status_change': 'Status',
    'consumption': 'Consumo',
    'replenishment': 'Reposição',
    'adjustment': 'Ajuste',
  };
  return labels[type] ?? type;
}
