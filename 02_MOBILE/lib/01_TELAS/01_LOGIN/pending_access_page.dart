import 'package:flutter/material.dart';
import 'package:metallo/08_ESTILOS/theme.dart';
import 'package:metallo/06_ACESSO_A_DADOS/auth_repository.dart';
import 'package:metallo/02_COMPONENTES/brand_logo.dart';

class PendingAccessPage extends StatelessWidget {
  const PendingAccessPage({
    super.key,
    required this.authRepository,
    required this.onRetry,
  });

  final AuthRepository authRepository;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        minimum: const EdgeInsets.all(28),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandLogo(height: 92),
              const SizedBox(height: 24),
              const Icon(Icons.hourglass_top_rounded,
                  size: 60, color: metalloPrimary),
              const SizedBox(height: 16),
              const Text(
                'Acesso aguardando liberação',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'O administrador precisa definir sua equipe e seu cargo antes do primeiro acesso.',
                style: TextStyle(color: Colors.white60),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Verificar novamente'),
              ),
              TextButton(
                onPressed: authRepository.signOut,
                child: const Text('Sair'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
