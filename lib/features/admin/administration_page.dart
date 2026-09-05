import 'package:flutter/material.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/shared/widgets/brand_logo.dart';
import 'package:metallo/features/admin/users_management_page.dart';
import 'package:metallo/features/admin/teams_page.dart';
import 'package:metallo/features/admin/create_employee_page.dart';

class AdministrationPage extends StatelessWidget {
  const AdministrationPage({super.key, required this.repo});
  final AdminRepository repo;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Administração')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const BrandLogo(height: 62),
          const SizedBox(height: 18),
          Card(
            child: ListTile(
              leading: const Icon(Icons.person_add_alt_1),
              title: const Text('Criar funcionário'),
              subtitle: const Text(
                  'Engenheiro, encarregado ou colaborador com equipe definida'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => CreateEmployeePage(repo: repo),
                ),
              ),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.manage_accounts_outlined),
              title: const Text('Gerenciar usuários'),
              subtitle: const Text('Cargo, equipe e liberação de acesso'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => UsersManagementPage(repo: repo),
                ),
              ),
            ),
          ),
          Card(
            child: ListTile(
              leading: const Icon(Icons.groups_2_outlined),
              title: const Text('Equipes'),
              subtitle: const Text('Criar, editar ou excluir'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => TeamsPage(repo: repo)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
