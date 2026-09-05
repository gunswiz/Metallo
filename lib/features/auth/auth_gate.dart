import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/features/auth/reset_password_page.dart';
import 'package:metallo/features/auth/profile_gate.dart';
import 'package:metallo/features/auth/login_page.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({
    super.key,
    required this.authRepository,
    required this.dashboardRepository,
    required this.catalogRepository,
    required this.epiRepository,
    required this.adminRepository,
    required this.movementRepository,
  });

  final AuthRepository authRepository;
  final DashboardRepository dashboardRepository;
  final CatalogRepository catalogRepository;
  final EpiRepository epiRepository;
  final AdminRepository adminRepository;
  final MovementRepository movementRepository;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: authRepository.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.data?.event == AuthChangeEvent.passwordRecovery) {
          return ResetPasswordPage(authRepository: authRepository);
        }
        if (!authRepository.hasCurrentSession) {
          return LoginPage(authRepository: authRepository);
        }
        return ProfileGate(
          authRepository: authRepository,
          dashboardRepository: dashboardRepository,
          catalogRepository: catalogRepository,
          epiRepository: epiRepository,
          adminRepository: adminRepository,
          movementRepository: movementRepository,
        );
      },
    );
  }
}
