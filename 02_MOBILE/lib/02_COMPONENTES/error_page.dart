import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class ErrorPage extends StatelessWidget {
  const ErrorPage({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 64),
              const SizedBox(height: 14),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 18),
              FilledButton(
                  onPressed: onRetry, child: const Text('Tentar novamente')),
              TextButton(
                onPressed: () => Supabase.instance.client.auth.signOut(),
                child: const Text('Sair'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
