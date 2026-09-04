import 'package:flutter/material.dart';

import '../../core/formatters.dart';

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(statusLabel(status)));
  }
}
