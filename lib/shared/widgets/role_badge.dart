import 'package:flutter/material.dart';

import '../../core/formatters.dart';

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF0E3965),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF2C8BE8)),
      ),
      child: Text(
        roleLabel(role),
        style: const TextStyle(
          color: Color(0xFF8CC8FF),
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}
