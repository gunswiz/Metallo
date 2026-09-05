import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/theme.dart';
import 'data/repositories/admin_repository.dart';
import 'data/repositories/auth_repository.dart';
import 'data/repositories/catalog_repository.dart';
import 'data/repositories/dashboard_repository.dart';
import 'data/repositories/epi_repository.dart';
import 'data/repositories/movement_repository.dart';
import 'features/auth/startup_splash.dart';

class MetalloApp extends StatelessWidget {
  MetalloApp({super.key, SupabaseClient? client}) {
    final supabaseClient = client ?? Supabase.instance.client;
    authRepository = AuthRepository(supabaseClient);
    dashboardRepository = DashboardRepository(supabaseClient);
    catalogRepository = CatalogRepository(supabaseClient, dashboardRepository);
    epiRepository = EpiRepository(supabaseClient, dashboardRepository);
    adminRepository = AdminRepository(supabaseClient, dashboardRepository);
    movementRepository =
        MovementRepository(supabaseClient, dashboardRepository);
  }

  late final AuthRepository authRepository;
  late final DashboardRepository dashboardRepository;
  late final CatalogRepository catalogRepository;
  late final EpiRepository epiRepository;
  late final AdminRepository adminRepository;
  late final MovementRepository movementRepository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Metallo',
      theme: metalloTheme(),
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      builder: (context, child) {
        final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
        return Stack(
          children: [
            Positioned.fill(child: child ?? const SizedBox.shrink()),
            if (!keyboardOpen)
              const Positioned(
                right: 7,
                bottom: 4,
                child: IgnorePointer(
                  child: SafeArea(
                    top: false,
                    left: false,
                    child: Text(
                      'Criado por WM',
                      style: TextStyle(
                        color: Color(0x336F8298),
                        fontSize: 7,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.1,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
      home: StartupSplash(
        authRepository: authRepository,
        dashboardRepository: dashboardRepository,
        catalogRepository: catalogRepository,
        epiRepository: epiRepository,
        adminRepository: adminRepository,
        movementRepository: movementRepository,
      ),
    );
  }
}
