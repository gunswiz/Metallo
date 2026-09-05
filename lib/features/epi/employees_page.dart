import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/features/epi/forms.dart';
import 'package:metallo/features/epi/epi_ui.dart';
import 'package:metallo/features/epi/employee_details.dart';

class TeamPeoplePage extends StatelessWidget {
  const TeamPeoplePage(
      {super.key,
      required this.repo,
      required this.adminRepository,
      required this.team,
      required this.people});
  final EpiRepository repo;
  final AdminRepository adminRepository;
  final Team team;
  final List<Map<String, dynamic>> people;
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(team.name)),
        body: people.isEmpty
            ? const Center(child: Text('Nenhum funcionário nesta equipe.'))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: people.length,
                itemBuilder: (_, i) {
                  final p = people[i];
                  return Card(
                      color: epiCardColor,
                      child: ListTile(
                        leading: const CircleAvatar(
                            backgroundColor: Color(0xFF0C355C),
                            child: Icon(Icons.person_outline, color: epiBlue)),
                        title: Text(p['full_name']?.toString() ?? 'Funcionário',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text(p['profession']?.toString() ?? ''),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => openEmployeeDetails(
                            context, repo, adminRepository, p),
                      ));
                },
              ),
      );
}

class EmployeesPage extends StatefulWidget {
  const EmployeesPage(
      {super.key,
      required this.repo,
      required this.adminRepository,
      required this.people,
      required this.teams,
      required this.role,
      required this.onRefresh});
  final EpiRepository repo;
  final AdminRepository adminRepository;
  final Future<List<Map<String, dynamic>>> people;
  final List<Team> teams;
  final String role;
  final VoidCallback onRefresh;
  @override
  State<EmployeesPage> createState() => EmployeesPageState();
}

class EmployeesPageState extends State<EmployeesPage> {
  String query = '';
  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: widget.people,
        builder: (context, snap) {
          if (snap.hasError) return EpiModuleError(onRetry: widget.onRefresh);
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final rows = snap.data!
              .where((p) =>
                  p['active'] == true &&
                  (p['full_name']
                          ?.toString()
                          .toLowerCase()
                          .contains(query.toLowerCase()) ??
                      false))
              .toList();
          return Column(children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                onChanged: (v) => setState(() => query = v),
                decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search),
                    hintText: 'Pesquisar funcionário ou profissão'),
              ),
            ),
            if (widget.role == 'admin')
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: FilledButton.icon(
                  onPressed: () async {
                    if (await showEmployeeForm(
                            context, widget.repo, widget.teams) &&
                        mounted) {
                      widget.onRefresh();
                    }
                  },
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                  label: const Text('Cadastrar funcionário'),
                ),
              ),
            Expanded(
                child: rows.isEmpty
                    ? const Center(
                        child: Text('Nenhum funcionário encontrado.'))
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                        itemCount: rows.length,
                        itemBuilder: (_, i) {
                          final person = rows[i];
                          final teamName =
                              (person['teams'] as Map?)?['name']?.toString() ??
                                  'Sem equipe';
                          return Card(
                            color: epiCardColor,
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              leading: const CircleAvatar(
                                  backgroundColor: Color(0xFF0C355C),
                                  child: Icon(Icons.person_outline,
                                      color: epiBlue)),
                              title: Text(
                                  person['full_name']?.toString() ??
                                      'Funcionário',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                              subtitle: Text(
                                  '${person['profession'] ?? 'Profissão não informada'} • $teamName\n${asoStatusLabel(person)}'),
                              trailing: const Icon(Icons.chevron_right_rounded),
                              onTap: () => openEmployeeDetails(context,
                                  widget.repo, widget.adminRepository, person),
                              onLongPress: widget.role == 'admin'
                                  ? () => showEmployeeActions(
                                      context,
                                      widget.repo,
                                      widget.teams,
                                      person,
                                      widget.onRefresh)
                                  : null,
                            ),
                          );
                        },
                      )),
          ]);
        },
      );
}
