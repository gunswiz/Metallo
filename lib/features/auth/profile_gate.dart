import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/data/repositories/catalog_repository.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/error_page.dart';
import 'package:metallo/features/shell/main_shell.dart';
import 'package:metallo/features/auth/pending_access_page.dart';

class ProfileGate extends StatefulWidget {
  const ProfileGate({
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
  State<ProfileGate> createState() => _ProfileGateState();
}

class _ProfileGateState extends State<ProfileGate> {
  late Future<Map<String, dynamic>?> profile;

  @override
  void initState() {
    super.initState();
    profile = widget.adminRepository.currentProfile();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: profile,
      builder: (context, snap) {
        if (snap.hasError) {
          return ErrorPage(
            message: friendlyError(snap.error),
            onRetry: () => setState(
                () => profile = widget.adminRepository.currentProfile()),
          );
        }
        if (!snap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final p = snap.data!;
        if (p['active'] != true) {
          return PendingAccessPage(
            authRepository: widget.authRepository,
            onRetry: () => setState(
                () => profile = widget.adminRepository.currentProfile()),
          );
        }
        return MainShell(
          profile: p,
          authRepository: widget.authRepository,
          dashboardRepository: widget.dashboardRepository,
          catalogRepository: widget.catalogRepository,
          epiRepository: widget.epiRepository,
          adminRepository: widget.adminRepository,
          movementRepository: widget.movementRepository,
        );
      },
    );
  }
}
