import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/repositories/admin_repository.dart';

class CreateEmployeePage extends StatefulWidget {
  const CreateEmployeePage({super.key, required this.repo});
  final AdminRepository repo;

  @override
  State<CreateEmployeePage> createState() => _CreateEmployeePageState();
}

class _CreateEmployeePageState extends State<CreateEmployeePage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  String role = 'collaborator';
  String? teamId;
  bool busy = false;
  String? error;
  Future<void> create() async {
    if (teamId == null) {
      setState(() => error = 'Selecione a equipe.');
      return;
    }
    if (name.text.trim().isEmpty || email.text.trim().isEmpty) {
      setState(() => error = 'Preencha nome e e-mail.');
      return;
    }
    if (password.text.length < 4) {
      setState(
          () => error = 'A senha temporária precisa ter 4 ou mais caracteres.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.repo.createEmployee(
        fullName: name.text,
        email: email.text,
        password: password.text,
        role: role,
        teamId: teamId!,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Funcionário criado e liberado.')),
        );
        name.clear();
        email.clear();
        password.clear();
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.dashboardRepository.watchDashboard(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final teams = snap.data!.teams;
        teamId ??= teams.isEmpty ? null : teams.first.id;

        return Scaffold(
          appBar: AppBar(title: const Text('Novo funcionário')),
          body: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 12),
              TextField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-mail'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: password,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Senha temporária (4+)'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Cargo'),
                items: const [
                  DropdownMenuItem(
                      value: 'engineer', child: Text('Engenheiro')),
                  DropdownMenuItem(value: 'leader', child: Text('Encarregado')),
                  DropdownMenuItem(
                      value: 'collaborator', child: Text('Colaborador')),
                ],
                onChanged: busy ? null : (v) => setState(() => role = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe'),
                items: teams
                    .map((t) =>
                        DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setState(() => teamId = v),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 18),
              FilledButton(
                onPressed: busy ? null : create,
                child: busy
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('Criar funcionário'),
              ),
            ],
          ),
        );
      },
    );
  }
}
