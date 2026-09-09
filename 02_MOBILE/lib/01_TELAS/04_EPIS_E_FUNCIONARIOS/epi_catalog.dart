import 'package:flutter/material.dart';

IconData epiKindIcon(String? kind) => switch (kind) {
      'uniform' => Icons.checkroom_outlined,
      'personal_tool' => Icons.handyman_outlined,
      _ => Icons.health_and_safety_outlined,
    };

String epiKindLabel(String? kind) => switch (kind) {
      'uniform' => 'Fardamento',
      'personal_tool' => 'Item pessoal',
      _ => 'EPI',
    };

String epiStatusLabel(String? status) => switch (status) {
      'returned' => 'Devolvido',
      'replaced' => 'Substituído',
      'lost' => 'Perdido',
      'damaged' => 'Danificado',
      'consumed' => 'Consumido',
      _ => 'Em uso',
    };

String epiSystemKey(Map? item) =>
    item?['system_key']?.toString().trim().toUpperCase() ??
    item?['code']?.toString().trim().toUpperCase() ??
    '';

bool isBootEpiItem(Map? item) => epiSystemKey(item) == 'EPI-BOT';

bool isGlassesEpiItem(Map? item) => epiSystemKey(item) == 'EPI-OCU';

List<(String, int)> recommendedEpiCodes(String profession, String kind) {
  final common = ['EPI-CAP', 'EPI-OCU', 'EPI-AUR', 'EPI-BOT'];
  final p = profession.toLowerCase();
  if (kind == 'uniform') {
    return [(p == 'encarregado' ? 'FARD-AZUL' : 'FARD-CINZA', 2)];
  }
  if (kind == 'personal_tool') {
    if (p == 'montador' || p == 'encarregado') {
      return [
        ('PES-TRENA', 1),
        ('PES-ESQ', 1),
        ('PES-RISC', 1),
        ('PES-LAPIS', 1)
      ];
    }
    if (p == 'soldador') return [('PES-BAT-SOLDA', 1)];
    return [];
  }
  var items = [...common];
  if (p == 'soldador') {
    items.addAll(['EPI-LUV-RASPA', 'EPI-MASC-SOLDA', 'EPI-AVENTAL']);
  }
  if (p == 'montador' || p == 'encarregado' || p == 'ajudante') {
    items.add('EPI-LUV-RASPA');
  }
  if (p.contains('operador de munck')) {
    items = ['EPI-LUV-RASPA', 'EPI-AUR', 'EPI-OCU', 'EPI-BOT'];
  }
  if (p == 'pintor') items.add('EPI-RESP-PINT');
  return items.map((x) => (x, 1)).toList();
}
