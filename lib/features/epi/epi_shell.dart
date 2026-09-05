import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/features/epi/reports_page.dart';
import 'package:metallo/features/epi/items_page.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/epi_home.dart';
import 'package:metallo/features/epi/employees_page.dart';
import 'package:metallo/features/epi/delivery.dart';

class EpiManagementShell extends StatefulWidget {
  const EpiManagementShell({
    super.key,
    required this.repo,
    required this.adminRepository,
    required this.teams,
    required this.role,
  });

  final EpiRepository repo;
  final AdminRepository adminRepository;
  final List<Team> teams;
  final String role;

  @override
  State<EpiManagementShell> createState() => _EpiManagementShellState();
}

class _EpiManagementShellState extends State<EpiManagementShell> {
  int _page = 0;
  bool _openingDelivery = false;
  int _refreshRevision = 0;
  late Future<List<Map<String, dynamic>>> _people =
      widget.repo.fetchEpiEmployees();

  void _refresh() {
    if (!mounted) return;
    setState(() {
      _people = widget.repo.fetchEpiEmployees();
      _refreshRevision++;
    });
  }

  Future<void> _openDelivery() async {
    if (_openingDelivery) return;
    setState(() => _openingDelivery = true);
    try {
      await showDeliveryStart(context, widget.repo, _refresh);
    } finally {
      if (mounted) setState(() => _openingDelivery = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      EpiHome(
          repo: widget.repo,
          adminRepository: widget.adminRepository,
          people: _people,
          teams: widget.teams,
          onRefresh: _refresh),
      EmployeesPage(
          repo: widget.repo,
          adminRepository: widget.adminRepository,
          people: _people,
          teams: widget.teams,
          role: widget.role,
          onRefresh: _refresh),
      ItemsPage(
          repo: widget.repo,
          role: widget.role,
          refreshRevision: _refreshRevision),
      ReportsPage(repo: widget.repo, refreshRevision: _refreshRevision),
    ];
    return Theme(
      data: Theme.of(context).copyWith(scaffoldBackgroundColor: epiBackground),
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: epiBackground,
          titleSpacing: 4,
          title: Row(children: [
            Image.asset('assets/metallo_logo_outline.png',
                height: 34, width: 42),
            const SizedBox(width: 8),
            const Text('METALLO',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2)),
          ]),
          actions: [
            IconButton(
                tooltip: 'Atualizar',
                onPressed: _refresh,
                icon: const Icon(Icons.refresh)),
            const Padding(
              padding: EdgeInsets.only(right: 12),
              child: Icon(Icons.notifications_none_rounded),
            ),
          ],
        ),
        body: IndexedStack(index: _page, children: pages),
        bottomNavigationBar: NavigationBar(
          height: 72,
          selectedIndex: _page > 1 ? _page + 1 : _page,
          onDestinationSelected: (value) {
            if (value == 2) {
              _openDelivery();
            } else {
              setState(() => _page = value > 2 ? value - 1 : value);
            }
          },
          destinations: [
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: 'Início'),
            NavigationDestination(
                icon: Icon(Icons.groups_2_outlined), label: 'Funcionários'),
            NavigationDestination(
                icon: _openingDelivery
                    ? const SizedBox(
                        width: 28,
                        height: 28,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.add_circle, size: 42, color: epiBlue),
                label: 'Entrega'),
            NavigationDestination(
                icon: Icon(Icons.inventory_2_outlined), label: 'Itens'),
            NavigationDestination(
                icon: Icon(Icons.assessment_outlined), label: 'Relatórios'),
          ],
        ),
      ),
    );
  }
}
