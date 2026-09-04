import 'package:flutter/material.dart';

class EquipmentOwnershipBadge extends StatelessWidget {
  const EquipmentOwnershipBadge({super.key, required this.type});
  final String type;
  @override
  Widget build(BuildContext context) {
    final rented = type == 'rented';
    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
            color: rented ? const Color(0xFF3A2E13) : const Color(0xFF173326),
            borderRadius: BorderRadius.circular(999)),
        child: Text(rented ? 'Alugado' : 'Próprio',
            style: TextStyle(
                color:
                    rented ? const Color(0xFFFFCC66) : const Color(0xFF72D6A0),
                fontSize: 11,
                fontWeight: FontWeight.w800)));
  }
}
