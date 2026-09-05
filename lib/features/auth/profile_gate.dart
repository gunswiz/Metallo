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
  late Stream<Map<String, dynamic>?> profile;

  @override
  void initState() {
    super.initState();
    profile = widget.adminRepository.watchCurrentProfile();
  }

  void _reloadProfile() {
    setState(() => profile = widget.adminRepository.watchCurrentProfile());
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Map<String, dynamic>?>(
      stream: profile,
      builder: (context, snap) {
        if (snap.hasError) {
          return ErrorPage(
            message: friendlyError(snap.error),
            onRetry: _reloadProfile,
          );
        }
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final p = snap.data;
        if (p == null || p['active'] != true) {
          return PendingAccessPage(
            authRepository: widget.authRepository,
            onRetry: _reloadProfile,
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
