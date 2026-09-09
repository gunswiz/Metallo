import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:metallo/06_ACESSO_A_DADOS/admin_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/auth_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/catalog_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/dashboard_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/epi_repository.dart';
import 'package:metallo/06_ACESSO_A_DADOS/movement_repository.dart';
import 'package:metallo/01_TELAS/01_LOGIN/reset_password_page.dart';
import 'package:metallo/01_TELAS/01_LOGIN/profile_gate.dart';
import 'package:metallo/01_TELAS/01_LOGIN/login_page.dart';

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
