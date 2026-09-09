import 'package:flutter/material.dart';

import '../04_FUNCOES_E_LOGICA/formatters.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(statusLabel(status)));
  }
}
