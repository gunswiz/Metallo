import 'package:flutter/material.dart';

import '../../core/errors.dart';
import 'empty_state.dart';
import 'offline_state.dart';

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error});
  final Object? error;

  @override
  Widget build(BuildContext context) {
    if (isConnectivityError(error)) {
      return const OfflineState();
    }
    return EmptyState(
      icon: Icons.error_outline,
      title: 'Não foi possível carregar',
      subtitle: friendlyError(error),
    );
  }
}
