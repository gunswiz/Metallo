import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/brand_logo.dart';
import 'package:metallo/features/auth/auth_gate.dart';

class StartupSplash extends StatefulWidget {
  const StartupSplash({
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
  State<StartupSplash> createState() => _StartupSplashState();
}

class _StartupSplashState extends State<StartupSplash> {
  static const _photos = <String>[
    'assets/splash_work_01.jpg',
    'assets/splash_work_02.jpg',
    'assets/splash_work_05.jpg',
    'assets/splash_work_04.jpg',
    'assets/splash_team_final.jpg',
  ];

  Timer? _timer;
  int _index = 0;
  bool _showLogo = false;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 360), _advanceSplash);
  }

  void _advanceSplash(Timer timer) {
    if (!mounted) return;
    if (_index < _photos.length - 1) {
      setState(() => _index++);
      return;
    }
    timer.cancel();
    setState(() => _showLogo = true);
    _timer = Timer(const Duration(milliseconds: 850), () {
      if (mounted) setState(() => _finished = true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return AuthGate(
        authRepository: widget.authRepository,
        dashboardRepository: widget.dashboardRepository,
        catalogRepository: widget.catalogRepository,
        epiRepository: widget.epiRepository,
        adminRepository: widget.adminRepository,
        movementRepository: widget.movementRepository,
      );
    }

    return _SplashMontage(
      photos: _photos,
      photoIndex: _index,
      showLogo: _showLogo,
    );
  }
}

class _SplashMontage extends StatelessWidget {
  const _SplashMontage({
    required this.photos,
    required this.photoIndex,
    required this.showLogo,
  });

  final List<String> photos;
  final int photoIndex;
  final bool showLogo;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          fit: StackFit.expand,
          children: [
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 220),
              switchInCurve: Curves.easeOut,
              switchOutCurve: Curves.easeIn,
              child: Image.asset(
                photos[photoIndex],
                key: ValueKey(photos[photoIndex]),
                fit: BoxFit.cover,
                alignment: Alignment.center,
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Color(0x26000000), Color(0x66000000)],
                ),
              ),
            ),
            AnimatedOpacity(
              opacity: showLogo ? 1 : 0,
              duration: const Duration(milliseconds: 420),
              child: Container(
                color: const Color(0xE605080D),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 38),
                child: const BrandLogo(height: 118),
              ),
            ),
          ],
        ),
      );
}
