part of '../../app.dart';

Color historyAccentColor(bool isMaterial, String type) {
  if (!isMaterial) return Colors.blueGrey.shade300;
  switch (type) {
    case 'entry':
      return const Color(0xFF89CFF0); // azul bebê
    case 'replenishment':
      return const Color(0xFF38BDF8); // azul celeste
    case 'consumption':
      return const Color(0xFF4F8CFF);
    default:
      return metalloAccent;
  }
}

class HistoryMovementIcon extends StatelessWidget {
  const HistoryMovementIcon({
    super.key,
    required this.isMaterial,
    required this.movementType,
    required this.color,
  });

  final bool isMaterial;
  final String movementType;
  final Color color;

  @override
  Widget build(BuildContext context) {
    Widget icon;
    if (!isMaterial) {
      icon = switch (movementType) {
        'transfer' => Icon(Icons.swap_horiz_rounded, color: color, size: 28),
        'maintenance' => Icon(Icons.build_rounded, color: color, size: 27),
        'return' => Icon(Icons.keyboard_return_rounded, color: color, size: 27),
        'status_change' => Icon(Icons.tune_rounded, color: color, size: 27),
        _ => Icon(Icons.handyman_outlined, color: color, size: 27),
      };
    } else if (movementType == 'entry') {
      icon = Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
              bottom: 4,
              child: Icon(Icons.inventory_2_outlined, color: color, size: 27)),
          Positioned(
              top: 2,
              child:
                  Icon(Icons.arrow_downward_rounded, color: color, size: 18)),
        ],
      );
    } else if (movementType == 'replenishment') {
      icon = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inventory_2_outlined, color: color, size: 16),
          Icon(Icons.arrow_forward_rounded, color: color, size: 14),
          Icon(Icons.inventory_2_outlined, color: color, size: 16),
        ],
      );
    } else if (movementType == 'consumption') {
      icon = Icon(Icons.construction_rounded, color: color, size: 28);
    } else {
      icon = Icon(Icons.inventory_2_outlined, color: color, size: 27);
    }

    return SizedBox(
      width: 48,
      height: 48,
      child: Center(child: icon),
    );
  }
}

String formatHistoryDateTime(dynamic value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return 'Data não informada';
  final d = parsed.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}/${two(d.month)}/${d.year} • ${two(d.hour)}:${two(d.minute)}';
}

String historySearchText(Map<String, dynamic> row) {
  final isMaterial = row['_kind'] == 'material';
  final item = isMaterial
      ? row['items'] as Map?
      : (row['assets'] as Map?)?['items'] as Map?;
  final asset = row['assets'] as Map?;
  final origin = row['origin'] as Map?;
  final destination = row['destination'] as Map?;
  return [
    item?['name'],
    item?['code'],
    asset?['asset_code'],
    origin?['name'],
    destination?['name'],
    movementLabel(row['movement_type']?.toString() ?? ''),
    row['movement_type'],
    row['note'],
    row['quantity'],
    formatHistoryDateTime(row['created_at']),
  ].where((e) => e != null).join(' ').toLowerCase();
}
