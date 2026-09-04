part of '../../app.dart';

IconData _kindIcon(String? kind) => switch (kind) {
      'uniform' => Icons.checkroom_outlined,
      'personal_tool' => Icons.handyman_outlined,
      _ => Icons.health_and_safety_outlined,
    };

String _kindLabel(String? kind) => switch (kind) {
      'uniform' => 'Fardamento',
      'personal_tool' => 'Item pessoal',
      _ => 'EPI',
    };

String _statusLabel(String? status) => switch (status) {
      'returned' => 'Devolvido',
      'replaced' => 'Substituído',
      'lost' => 'Perdido',
      'damaged' => 'Danificado',
      'consumed' => 'Consumido',
      _ => 'Em uso',
    };

List<(String, int)> _recommendedCodes(String profession, String kind) {
  final common = ['EPI-CAP', 'EPI-OCU', 'EPI-AUR', 'EPI-BOT'];
  final p = profession.toLowerCase();
  if (kind == 'uniform')
    return [(p == 'encarregado' ? 'FARD-AZUL' : 'FARD-CINZA', 2)];
  if (kind == 'personal_tool') {
    if (p == 'montador' || p == 'encarregado')
      return [
        ('PES-TRENA', 1),
        ('PES-ESQ', 1),
        ('PES-RISC', 1),
        ('PES-LAPIS', 1)
      ];
    if (p == 'soldador') return [('PES-BAT-SOLDA', 1)];
    return [];
  }
  var items = [...common];
  if (p == 'soldador')
    items.addAll(['EPI-LUV-RASPA', 'EPI-MASC-SOLDA', 'EPI-AVENTAL']);
  if (p == 'montador' || p == 'encarregado' || p == 'ajudante')
    items.add('EPI-LUV-RASPA');
  if (p.contains('operador de munck')) {
    items = ['EPI-LUV-RASPA', 'EPI-AUR', 'EPI-OCU', 'EPI-BOT'];
  }
  if (p == 'pintor') items.add('EPI-RESP-PINT');
  return items.map((x) => (x, 1)).toList();
}
