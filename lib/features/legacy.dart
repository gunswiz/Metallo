part of '../app.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage(
      {super.key,
      required this.role,
      required this.onReplayTutorial,
      this.onStartGuidedPractice});
  final String role;
  final Future<void> Function() onReplayTutorial;
  final Future<void> Function(_HelpTopic)? onStartGuidedPractice;

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  late final TextEditingController email = TextEditingController(
    text: Supabase.instance.client.auth.currentUser?.email ?? '',
  );
  final password = TextEditingController();
  final password2 = TextEditingController();
  bool busy = false;
  String? message;
  String? error;

  Future<void> changeEmail() async {
    final value = email.text.trim();
    if (value.isEmpty || !value.contains('@')) {
      setState(() => error = 'Informe um e-mail válido.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      await Supabase.instance.client.auth
          .updateUser(UserAttributes(email: value));
      if (mounted)
        setState(() => message =
            'Solicitação enviada. Confirme a alteração pelos e-mails de segurança enviados pelo Supabase.');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> changePassword() async {
    if (password.text.length < 4) {
      setState(
          () => error = 'A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (password.text != password2.text) {
      setState(() => error = 'As senhas não são iguais.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
    try {
      await Supabase.instance.client.auth
          .updateUser(UserAttributes(password: password.text));
      password.clear();
      password2.clear();
      if (mounted) setState(() => message = 'Senha alterada com sucesso.');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Minha conta')),
        body: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const BrandLogo(height: 62),
            const SizedBox(height: 20),
            const Text('Alterar e-mail',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            TextField(
                controller: email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                    labelText: 'Novo e-mail',
                    prefixIcon: Icon(Icons.email_outlined))),
            const SizedBox(height: 10),
            FilledButton.icon(
                onPressed: busy ? null : changeEmail,
                icon: const Icon(Icons.mark_email_read_outlined),
                label: const Text('Solicitar alteração de e-mail')),
            const SizedBox(height: 26),
            const Text('Alterar senha',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            TextField(
                controller: password,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Nova senha (4+)')),
            const SizedBox(height: 10),
            TextField(
                controller: password2,
                obscureText: true,
                decoration:
                    const InputDecoration(labelText: 'Confirmar nova senha')),
            const SizedBox(height: 10),
            FilledButton.icon(
                onPressed: busy ? null : changePassword,
                icon: const Icon(Icons.lock_reset),
                label: const Text('Alterar senha')),
            const SizedBox(height: 26),
            const Text('Ajuda',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: busy
                  ? null
                  : () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => HelpGuidePage(
                          role: widget.role,
                          onStartGuidedPractice:
                              widget.onStartGuidedPractice))),
              icon: const Icon(Icons.menu_book_outlined),
              label: const Text('Abrir guia prático'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      Navigator.of(context).pop();
                      await widget.onReplayTutorial();
                    },
              icon: const Icon(Icons.school_outlined),
              label: const Text('Ver tutorial do aplicativo novamente'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: busy
                  ? null
                  : () => AppUpdateService.showIfAvailable(context,
                      showUpToDate: true),
              icon: const Icon(Icons.system_update_alt_rounded),
              label: const Text('Verificar atualização'),
            ),
            if (message != null) ...[
              const SizedBox(height: 14),
              Text(message!, style: const TextStyle(color: Color(0xFF67D39A))),
            ],
            if (error != null) ...[
              const SizedBox(height: 14),
              Text(error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
        ),
      );
}

class AdministrationPage extends StatelessWidget {
  const AdministrationPage({super.key, required this.repo});
  final MetalloRepository repo;

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

class CreateEmployeePage extends StatefulWidget {
  const CreateEmployeePage({super.key, required this.repo});
  final MetalloRepository repo;

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
  late Future<DashboardSnapshot> dashboard = widget.repo.fetchDashboard();

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
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.watchDashboard(),
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

class UsersManagementPage extends StatefulWidget {
  const UsersManagementPage({super.key, required this.repo});
  final MetalloRepository repo;

  @override
  State<UsersManagementPage> createState() => _UsersManagementPageState();
}

class _UsersManagementPageState extends State<UsersManagementPage> {
  late Future<List<Map<String, dynamic>>> users = widget.repo.fetchProfiles();
  late Future<DashboardSnapshot> dashboard = widget.repo.fetchDashboard();

  void reload() => setState(() => users = widget.repo.fetchProfiles());

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.watchDashboard(),
      builder: (context, teamSnap) {
        if (!teamSnap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final teams = teamSnap.data!.teams;

        return Scaffold(
          appBar: AppBar(title: const Text('Usuários')),
          body: FutureBuilder<List<Map<String, dynamic>>>(
            future: users,
            builder: (context, snap) {
              if (snap.hasError) return ErrorState(error: snap.error);
              if (!snap.hasData)
                return const Center(child: CircularProgressIndicator());
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  for (final user in snap.data!)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          user['active'] == true
                              ? Icons.verified_user_outlined
                              : Icons.hourglass_empty,
                        ),
                        title: Text(user['full_name']?.toString() ?? 'Usuário'),
                        subtitle: Text(
                          '${roleLabel(user['role']?.toString() ?? 'collaborator')} • '
                          '${(user['teams'] as Map?)?['name'] ?? 'Sem equipe'} • '
                          '${user['active'] == true ? 'Ativo' : 'Aguardando liberação'}',
                        ),
                        trailing: PopupMenuButton<String>(
                          onSelected: (action) async {
                            if (action == 'edit') {
                              await showUserEditDialog(
                                  context, widget.repo, teams, user);
                              reload();
                            } else if (action == 'delete') {
                              final yes = await confirm(
                                context,
                                'Excluir usuário?',
                                'O acesso será removido permanentemente. O histórico operacional já registrado será preservado.',
                              );
                              if (yes == true) {
                                try {
                                  await widget.repo
                                      .deleteEmployee(user['id'].toString());
                                  reload();
                                } catch (e) {
                                  if (context.mounted) showError(context, e);
                                }
                              }
                            }
                          },
                          itemBuilder: (_) => const [
                            PopupMenuItem(value: 'edit', child: Text('Editar')),
                            PopupMenuItem(
                                value: 'delete', child: Text('Excluir')),
                          ],
                        ),
                        onTap: () async {
                          await showUserEditDialog(
                              context, widget.repo, teams, user);
                          reload();
                        },
                      ),
                    ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}

class TeamsPage extends StatefulWidget {
  const TeamsPage({super.key, required this.repo});
  final MetalloRepository repo;

  @override
  State<TeamsPage> createState() => _TeamsPageState();
}

class _TeamsPageState extends State<TeamsPage> {
  late Future<DashboardSnapshot> future = widget.repo.fetchDashboard();

  void reload() => setState(() => future = widget.repo.fetchDashboard());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Equipes')),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: 'team-create-fab',
        onPressed: () async {
          await showTeamDialog(context, widget.repo);
          reload();
        },
        icon: const Icon(Icons.add),
        label: const Text('Criar equipe'),
      ),
      body: FutureBuilder<DashboardSnapshot>(
        future: future,
        builder: (context, snap) {
          if (snap.hasError) return ErrorState(error: snap.error);
          if (!snap.hasData)
            return const Center(child: CircularProgressIndicator());
          final teams = snap.data!.teams;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${teams.where((t) => !t.isCentral).length} equipes de campo • COSEM separada',
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              for (final t in teams)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.groups_2_outlined),
                    title: Text(t.name),
                    subtitle:
                        t.description == null ? null : Text(t.description!),
                    trailing: PopupMenuButton<String>(
                      onSelected: (action) async {
                        if (action == 'edit') {
                          await showTeamDialog(context, widget.repo, team: t);
                          reload();
                        } else if (action == 'delete') {
                          final yes = await confirm(
                            context,
                            'Excluir equipe?',
                            'A equipe só poderá ser excluída se não tiver estoque, equipamentos ou usuários ativos.',
                          );
                          if (yes == true) {
                            try {
                              await widget.repo.deleteTeam(t.id);
                              reload();
                            } catch (e) {
                              if (context.mounted) showError(context, e);
                            }
                          }
                        }
                      },
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'edit', child: Text('Editar')),
                        PopupMenuItem(value: 'delete', child: Text('Excluir')),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

Future<void> showUserEditDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> user,
) async {
  final actionLock = UiActionLock.acquire(context, 'showUserEditDialog');
  if (actionLock == null) return;
  try {
    final name =
        TextEditingController(text: user['full_name']?.toString() ?? '');
    String role = user['role']?.toString() ?? 'collaborator';
    String? teamId = user['team_id']?.toString();
    bool active = user['active'] == true;
    bool busy = false;
    String? error;

    await showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: const Text('Editar usuário'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: 'Nome')),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: role,
                  decoration: const InputDecoration(labelText: 'Cargo'),
                  items: const [
                    DropdownMenuItem(value: 'admin', child: Text('Admin')),
                    DropdownMenuItem(
                        value: 'engineer', child: Text('Engenheiro')),
                    DropdownMenuItem(
                        value: 'leader', child: Text('Encarregado')),
                    DropdownMenuItem(
                        value: 'collaborator', child: Text('Colaborador')),
                  ],
                  onChanged: busy ? null : (v) => setLocal(() => role = v!),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: teamId,
                  decoration: const InputDecoration(labelText: 'Equipe'),
                  items: teams
                      .map((t) =>
                          DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => teamId = v),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Acesso liberado'),
                  value: active,
                  onChanged: busy ? null : (v) => setLocal(() => active = v),
                ),
                if (error != null)
                  Text(error!,
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.error)),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (busy) return;
                      if (role != 'admin' && teamId == null) {
                        setLocal(() => error = 'Selecione uma equipe.');
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await repo.updateProfileAdmin(
                          userId: user['id'].toString(),
                          fullName: name.text,
                          role: role,
                          teamId: role == 'admin' ? teamId : teamId,
                          active: active,
                        );
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        setLocal(() => error = friendlyError(e));
                      } finally {
                        if (dialogContext.mounted) setLocal(() => busy = false);
                      }
                    },
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}

Future<void> showTeamDialog(
  BuildContext context,
  MetalloRepository repo, {
  Team? team,
}) async {
  final actionLock = UiActionLock.acquire(context, 'showTeamDialog');
  if (actionLock == null) return;
  try {
    final name = TextEditingController(text: team?.name ?? '');
    final desc = TextEditingController(text: team?.description ?? '');
    bool busy = false;
    String? error;

    await showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: Text(team == null ? 'Nova equipe' : 'Editar equipe'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 10),
              TextField(
                controller: desc,
                decoration:
                    const InputDecoration(labelText: 'Descrição (opcional)'),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.pop(dialogContext),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (busy) return;
                      if (name.text.trim().isEmpty) {
                        setLocal(() => error = 'Informe o nome.');
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        if (team == null) {
                          await repo.createTeam(name.text, desc.text);
                        } else {
                          await repo.updateTeam(team.id, name.text, desc.text);
                        }
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        setLocal(() => error = friendlyError(e));
                      } finally {
                        if (dialogContext.mounted) setLocal(() => busy = false);
                      }
                    },
              child: Text(team == null ? 'Criar' : 'Salvar'),
            ),
          ],
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}
