import 'package:flutter/material.dart';
import 'package:metallo/06_ACESSO_A_DADOS/admin_repository.dart';
import 'package:metallo/02_COMPONENTES/brand_logo.dart';
import 'package:metallo/01_TELAS/05_ADMINISTRACAO_E_EQUIPES/users_management_page.dart';
import 'package:metallo/01_TELAS/05_ADMINISTRACAO_E_EQUIPES/teams_page.dart';
import 'package:metallo/01_TELAS/05_ADMINISTRACAO_E_EQUIPES/create_employee_page.dart';

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
          _AdministrationOptionCard(
            icon: Icons.person_add_alt_1,
            title: 'Criar acesso ao Metallo',
            subtitle:
                'Conta, equipe e permissões do responsável que usa o aplicativo',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => CreateEmployeePage(repo: repo),
              ),
            ),
          ),
          _AdministrationOptionCard(
            icon: Icons.manage_accounts_outlined,
            title: 'Gerenciar usuários',
            subtitle: 'Cargo, equipes autorizadas e permissões de operação',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => UsersManagementPage(repo: repo),
              ),
            ),
          ),
          _AdministrationOptionCard(
            icon: Icons.groups_2_outlined,
            title: 'Equipes',
            subtitle: 'Criar, editar ou excluir',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => TeamsPage(repo: repo)),
            ),
          ),
        ],
      ),
    );
  }
}

class _AdministrationOptionCard extends StatelessWidget {
  const _AdministrationOptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          leading: Icon(icon),
          title: Text(title),
          subtitle: Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        ),
      );
}
