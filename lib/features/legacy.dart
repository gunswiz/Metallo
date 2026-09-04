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

Color historyAccentColor(bool isMaterial, String type) {
  if (!isMaterial) return Colors.blueGrey.shade300;
  switch (type) {
    case 'entry':
      return const Color(0xFF89CFF0); // azul bebê
    case 'replenishment':
      return const Color(0xFF38BDF8); // azul celeste
    case 'consumption':
      return const Color(0xFF4F8CFF);
    default:
      return const Color(0xFF52A9FF);
  }
}

class HistoryMovementIcon extends StatelessWidget {
  const HistoryMovementIcon({
    super.key,
    required this.isMaterial,
    required this.movementType,
    required this.color,
  });

  final bool isMaterial;
  final String movementType;
  final Color color;

  @override
  Widget build(BuildContext context) {
    Widget icon;
    if (!isMaterial) {
      icon = switch (movementType) {
        'transfer' => Icon(Icons.swap_horiz_rounded, color: color, size: 28),
        'maintenance' => Icon(Icons.build_rounded, color: color, size: 27),
        'return' => Icon(Icons.keyboard_return_rounded, color: color, size: 27),
        'status_change' => Icon(Icons.tune_rounded, color: color, size: 27),
        _ => Icon(Icons.handyman_outlined, color: color, size: 27),
      };
    } else if (movementType == 'entry') {
      icon = Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
              bottom: 4,
              child: Icon(Icons.inventory_2_outlined, color: color, size: 27)),
          Positioned(
              top: 2,
              child:
                  Icon(Icons.arrow_downward_rounded, color: color, size: 18)),
        ],
      );
    } else if (movementType == 'replenishment') {
      icon = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inventory_2_outlined, color: color, size: 16),
          Icon(Icons.arrow_forward_rounded, color: color, size: 14),
          Icon(Icons.inventory_2_outlined, color: color, size: 16),
        ],
      );
    } else if (movementType == 'consumption') {
      icon = Icon(Icons.construction_rounded, color: color, size: 28);
    } else {
      icon = Icon(Icons.inventory_2_outlined, color: color, size: 27);
    }

    return SizedBox(
      width: 48,
      height: 48,
      child: Center(child: icon),
    );
  }
}

String formatHistoryDateTime(dynamic value) {
  final parsed = DateTime.tryParse(value?.toString() ?? '');
  if (parsed == null) return 'Data não informada';
  final d = parsed.toLocal();
  String two(int v) => v.toString().padLeft(2, '0');
  return '${two(d.day)}/${two(d.month)}/${d.year} • ${two(d.hour)}:${two(d.minute)}';
}

String historySearchText(Map<String, dynamic> row) {
  final isMaterial = row['_kind'] == 'material';
  final item = isMaterial
      ? row['items'] as Map?
      : (row['assets'] as Map?)?['items'] as Map?;
  final asset = row['assets'] as Map?;
  final origin = row['origin'] as Map?;
  final destination = row['destination'] as Map?;
  return [
    item?['name'],
    item?['code'],
    asset?['asset_code'],
    origin?['name'],
    destination?['name'],
    movementLabel(row['movement_type']?.toString() ?? ''),
    row['movement_type'],
    row['note'],
    row['quantity'],
    formatHistoryDateTime(row['created_at']),
  ].where((e) => e != null).join(' ').toLowerCase();
}

Future<void> showHistoryDetails(
    BuildContext context, Map<String, dynamic> row) async {
  final isMaterial = row['_kind'] == 'material';
  final item = isMaterial
      ? row['items'] as Map?
      : (row['assets'] as Map?)?['items'] as Map?;
  final asset = row['assets'] as Map?;
  final origin = (row['origin'] as Map?)?['name']?.toString();
  final destination = (row['destination'] as Map?)?['name']?.toString();
  final note = row['note']?.toString();
  final movement = movementLabel(row['movement_type']?.toString() ?? '');
  final name =
      item?['name']?.toString() ?? (isMaterial ? 'Material' : 'Equipamento');
  final code = item?['code']?.toString();
  final assetCode = asset?['asset_code']?.toString();
  final previousStatus = row['previous_status']?.toString();
  final newStatus = row['new_status']?.toString();

  Widget line(IconData icon, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: const Color(0xFF52A9FF)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style:
                          const TextStyle(color: Colors.white60, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(value,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      );

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF0A0F16),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
            20, 18, 20, 24 + MediaQuery.viewInsetsOf(sheetContext).bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    icon: const Icon(Icons.close)),
              ],
            ),
            Text(movement,
                style: const TextStyle(
                    color: Color(0xFF8CC8FF), fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            const Divider(),
            line(Icons.calendar_month_outlined, 'Data e horário',
                formatHistoryDateTime(row['created_at'])),
            if ((code ?? '').isNotEmpty) line(Icons.tag, 'Código', code!),
            if (!isMaterial && (assetCode ?? '').isNotEmpty)
              line(Icons.tag_outlined, 'Patrimônio / código individual',
                  assetCode!),
            if (isMaterial)
              line(Icons.numbers, 'Quantidade', '${row['quantity'] ?? 0}'),
            if (origin != null && origin.isNotEmpty)
              line(Icons.logout, 'Origem', origin),
            if (destination != null && destination.isNotEmpty)
              line(Icons.login, 'Destino', destination),
            if (!isMaterial && (previousStatus ?? '').isNotEmpty)
              line(Icons.swap_horiz, 'Status anterior',
                  statusLabel(previousStatus!)),
            if (!isMaterial && (newStatus ?? '').isNotEmpty)
              line(Icons.check_circle_outline, 'Novo status',
                  statusLabel(newStatus!)),
            if (note != null && note.trim().isNotEmpty)
              line(Icons.notes, 'Observação', note),
          ],
        ),
      ),
    ),
  );
}

class ConsumptionPage extends StatefulWidget {
  const ConsumptionPage({super.key, required this.repo, required this.stream});
  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;

  @override
  State<ConsumptionPage> createState() => _ConsumptionPageState();
}

class _ConsumptionPageState extends State<ConsumptionPage> {
  String? teamId;
  String period = 'month';

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.stream,
      builder: (context, ds) {
        if (!ds.hasData)
          return const Center(child: CircularProgressIndicator());
        final teams = ds.data!.teams.where((t) => !t.isCentral).toList();
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.repo.fetchMaterialConsumption(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData)
              return const Center(child: CircularProgressIndicator());
            final rows = snap.data!;
            final now = DateTime.now();
            final current = _filterConsumption(rows, teamId,
                _periodStart(now, period), _periodEnd(now, period));
            final previousStart = period == 'week'
                ? _periodStart(now, period).subtract(const Duration(days: 7))
                : DateTime(now.year, now.month - 1, 1);
            final previousEnd = _periodStart(now, period);
            final previous =
                _filterConsumption(rows, teamId, previousStart, previousEnd);
            final currentTotal = _sumConsumption(current);
            final previousTotal = _sumConsumption(previous);
            final change = _percentChange(currentTotal, previousTotal);
            final ranking = _groupMaterials(current, previous);
            final categories = _groupCategories(current);

            return RefreshIndicator(
              onRefresh: () async {
                setState(() {});
                await widget.repo.refreshDashboard();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 92),
                children: [
                  Row(
                    children: [
                      const Expanded(
                          child: Text('Consumo',
                              style: TextStyle(
                                  fontSize: 25, fontWeight: FontWeight.w900))),
                      IconButton(
                        tooltip: 'Consumo semanal',
                        icon: const Icon(Icons.table_rows_rounded),
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => ConsumptionMaterialsPage(
                                    rows: rows,
                                    teams: teams,
                                    initialTeamId: teamId))),
                      ),
                      IconButton(
                        tooltip: 'Gráficos',
                        icon: const Icon(Icons.filter_alt_outlined),
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => ConsumptionGraphsPage(
                                    rows: rows,
                                    teams: teams,
                                    initialTeamId: teamId))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Column(children: [
                    _teamDropdown(
                        teams, teamId, (v) => setState(() => teamId = v)),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      initialValue: period,
                      decoration: const InputDecoration(
                          labelText: 'Período',
                          prefixIcon: Icon(Icons.calendar_month_outlined)),
                      items: const [
                        DropdownMenuItem(
                            value: 'week', child: Text('Esta semana')),
                        DropdownMenuItem(
                            value: 'month', child: Text('Este mês')),
                      ],
                      onChanged: (v) => setState(() => period = v ?? 'month'),
                    ),
                  ]),
                  const SizedBox(height: 14),
                  _MetricCard(
                    eyebrow:
                        'COMPARAÇÃO COM ${period == 'week' ? 'SEMANA' : 'MÊS'} ANTERIOR',
                    title: 'Total consumido',
                    value: _formatQty(currentTotal),
                    suffix: _mixedUnits(current),
                    change: change,
                    comparisonText:
                        'vs ${period == 'week' ? 'Semana' : 'Mês'} anterior',
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Resumo por categoria',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                            const SizedBox(height: 14),
                            if (categories.isEmpty)
                              const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 18),
                                  child: Text('Nenhum consumo neste período.',
                                      style: TextStyle(color: Colors.white54)))
                            else
                              Row(children: [
                                SizedBox(
                                    width: 130,
                                    height: 130,
                                    child: ConsumptionDonutChart(
                                        data: categories)),
                                const SizedBox(width: 14),
                                Expanded(
                                    child: Column(children: [
                                  for (int i = 0;
                                      i < categories.length && i < 5;
                                      i++)
                                    _CategoryLegendRow(
                                        index: i, data: categories[i])
                                ])),
                              ]),
                          ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Top 5 materiais mais consumidos',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                            const SizedBox(height: 8),
                            if (ranking.isEmpty)
                              const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 14),
                                  child: Text('Nenhum consumo registrado.',
                                      style: TextStyle(color: Colors.white54)))
                            else
                              for (int i = 0; i < ranking.length && i < 5; i++)
                                _RankingRow(
                                    index: i,
                                    data: ranking[i],
                                    onTap: () {
                                      Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                              builder: (_) =>
                                                  ConsumptionMaterialDetailPage(
                                                      rows: rows,
                                                      teams: teams,
                                                      itemId: ranking[i]['id']
                                                          .toString(),
                                                      initialTeamId: teamId)));
                                    }),
                          ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: OutlinedButton.icon(
                      icon: const Icon(Icons.show_chart_rounded),
                      label: const Text('Ver gráficos'),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ConsumptionGraphsPage(
                                  rows: rows,
                                  teams: teams,
                                  initialTeamId: teamId))),
                    )),
                    const SizedBox(width: 10),
                    Expanded(
                        child: OutlinedButton.icon(
                      icon: const Icon(Icons.compare_arrows_rounded),
                      label: const Text('Comparar equipes'),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => ConsumptionTeamsComparePage(
                                  rows: rows, teams: teams))),
                    )),
                  ]),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

class ConsumptionMaterialsPage extends StatefulWidget {
  const ConsumptionMaterialsPage(
      {super.key, required this.rows, required this.teams, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialsPage> createState() =>
      _ConsumptionMaterialsPageState();
}

class _ConsumptionMaterialsPageState extends State<ConsumptionMaterialsPage> {
  late String? teamId = widget.initialTeamId;
  DateTime anchor = DateTime.now();
  int periodDays = 7;
  @override
  Widget build(BuildContext context) {
    final end = DateTime(anchor.year, anchor.month, anchor.day)
        .add(const Duration(days: 1));
    final start = end.subtract(Duration(days: periodDays));
    final prevStart = start.subtract(Duration(days: periodDays));
    final current = _filterConsumption(widget.rows, teamId, start, end);
    final previous = _filterConsumption(widget.rows, teamId, prevStart, start);
    final grouped = _groupMaterials(current, previous);
    final total = _sumConsumption(current);
    final change = _percentChange(total, _sumConsumption(previous));
    final periodLabel = _consumptionPeriodLabel(periodDays);
    return Scaffold(
      appBar: AppBar(title: const Text('Consumo de materiais')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Expanded(
                  child: _teamDropdown(
                      widget.teams, teamId, (v) => setState(() => teamId = v))),
              const SizedBox(width: 10),
              Expanded(
                  child: DropdownButtonFormField<int>(
                initialValue: periodDays,
                decoration: const InputDecoration(
                    labelText: 'Período',
                    prefixIcon: Icon(Icons.calendar_month_outlined)),
                items: const [
                  DropdownMenuItem(value: 7, child: Text('7 dias')),
                  DropdownMenuItem(value: 30, child: Text('30 dias')),
                  DropdownMenuItem(value: 90, child: Text('3 meses')),
                  DropdownMenuItem(value: 180, child: Text('6 meses')),
                ],
                onChanged: (v) => setState(() {
                  periodDays = v ?? 7;
                  anchor = DateTime.now();
                }),
              )),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              IconButton.filledTonal(
                  onPressed: () => setState(() =>
                      anchor = anchor.subtract(Duration(days: periodDays))),
                  icon: const Icon(Icons.chevron_left)),
              Expanded(
                  child: Center(
                      child: Text(
                          '${_dateBr(start)} - ${_dateBr(end.subtract(const Duration(days: 1)))}',
                          style:
                              const TextStyle(fontWeight: FontWeight.w900)))),
              IconButton.filledTonal(
                  onPressed: () => setState(
                      () => anchor = anchor.add(Duration(days: periodDays))),
                  icon: const Icon(Icons.chevron_right)),
            ]),
            const SizedBox(height: 10),
            _MetricCard(
                eyebrow: 'TOTAL CONSUMIDO EM $periodLabel',
                title: '',
                value: _formatQty(total),
                suffix: _mixedUnits(current),
                change: change,
                comparisonText: 'vs período anterior'),
            const SizedBox(height: 12),
            Card(
                child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Column(children: [
                      Container(
                          color: Colors.white.withValues(alpha: .045),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                          child: const Row(children: [
                            Expanded(
                                flex: 5,
                                child: Text('Material',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 2,
                                child: Text('Quantidade',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 2,
                                child: Text('Unidade',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70))),
                            Expanded(
                                flex: 3,
                                child: Text('Vs. período ant.',
                                    textAlign: TextAlign.end,
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.white70)))
                          ])),
                      if (grouped.isEmpty)
                        const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text('Nenhum consumo neste período.')),
                      for (final g in grouped) _ConsumptionTableRow(data: g),
                    ]))),
          ]),
    );
  }
}

class ConsumptionGraphsPage extends StatefulWidget {
  const ConsumptionGraphsPage(
      {super.key, required this.rows, required this.teams, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String? initialTeamId;
  @override
  State<ConsumptionGraphsPage> createState() => _ConsumptionGraphsPageState();
}

class _ConsumptionGraphsPageState extends State<ConsumptionGraphsPage> {
  late String? teamId = widget.initialTeamId;
  int tab = 0;
  int periodDays = 180;
  String? materialId;
  @override
  Widget build(BuildContext context) {
    final teamRows = widget.rows
        .where(
            (r) => teamId == null || r['origin_team_id']?.toString() == teamId)
        .toList();
    final now = DateTime.now();
    final end =
        DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    final start = end.subtract(Duration(days: periodDays));
    final filtered = _filterConsumption(teamRows, null, start, end);
    final trend = _consumptionTrend(teamRows, start, end, periodDays);
    final categories = _groupCategories(filtered);
    final materials = _groupMaterials(filtered, const []);
    if (materialId != null &&
        !materials.any((g) => g['id'].toString() == materialId))
      materialId = null;
    materialId ??=
        materials.isNotEmpty ? materials.first['id'].toString() : null;
    final materialRows = materialId == null
        ? <Map<String, dynamic>>[]
        : teamRows
            .where((r) => r['item_id']?.toString() == materialId)
            .toList();
    final materialTrend = materialId == null
        ? <Map<String, dynamic>>[]
        : _consumptionTrend(materialRows, start, end, periodDays);
    final displayTrend = tab == 2 ? materialTrend : trend;
    final totals =
        displayTrend.map((e) => (e['qty'] as num).toDouble()).toList();
    final total = totals.fold<double>(0, (a, b) => a + b);
    final avg = totals.isEmpty ? 0.0 : total / totals.length;
    final maxValue =
        totals.isEmpty ? 0.0 : totals.reduce((a, b) => a > b ? a : b);
    final avgTitle = periodDays <= 7
        ? 'Média diária'
        : periodDays <= 30
            ? 'Média por faixa'
            : periodDays <= 90
                ? 'Média quinzenal'
                : 'Média mensal';
    return Scaffold(
      appBar: AppBar(title: const Text('Consumo em gráficos')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Expanded(
                  child: _teamDropdown(
                      widget.teams, teamId, (v) => setState(() => teamId = v))),
              const SizedBox(width: 10),
              Expanded(
                  child: DropdownButtonFormField<int>(
                initialValue: periodDays,
                decoration: const InputDecoration(
                    labelText: 'Período',
                    prefixIcon: Icon(Icons.calendar_month_outlined)),
                items: const [
                  DropdownMenuItem(value: 7, child: Text('7 dias')),
                  DropdownMenuItem(value: 30, child: Text('30 dias')),
                  DropdownMenuItem(value: 90, child: Text('90 dias')),
                  DropdownMenuItem(value: 180, child: Text('6 meses')),
                ],
                onChanged: (v) => setState(() => periodDays = v ?? 180),
              )),
            ]),
            const SizedBox(height: 14),
            SegmentedButton<int>(segments: const [
              ButtonSegment(value: 0, label: Text('Evolução')),
              ButtonSegment(value: 1, label: Text('Por categoria')),
              ButtonSegment(value: 2, label: Text('Por material')),
            ], selected: {
              tab
            }, onSelectionChanged: (v) => setState(() => tab = v.first)),
            if (tab == 2 && materials.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                  initialValue: materialId,
                  decoration: const InputDecoration(labelText: 'Material'),
                  items: materials
                      .map((g) => DropdownMenuItem(
                          value: g['id'].toString(),
                          child: Text('${g['code']} • ${g['name']}',
                              overflow: TextOverflow.ellipsis)))
                      .toList(),
                  onChanged: (v) => setState(() => materialId = v)),
            ],
            const SizedBox(height: 14),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              tab == 1
                                  ? 'Consumo por categoria'
                                  : tab == 2
                                      ? 'Evolução por material'
                                      : 'Evolução do consumo (${_consumptionScaleLabel(periodDays)})',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 4),
                          Text(
                              tab == 1
                                  ? 'Participação no período'
                                  : '${_dateBr(start)} - ${_dateBr(end.subtract(const Duration(days: 1)))} • ${_mixedUnits(filtered)}',
                              style: const TextStyle(
                                  color: Colors.white54, fontSize: 12)),
                          const SizedBox(height: 18),
                          SizedBox(
                              height: 260,
                              child: tab == 1
                                  ? ConsumptionDonutChart(
                                      data: categories, showLabels: true)
                                  : ConsumptionLineChart(data: displayTrend)),
                        ]))),
            if (tab != 1) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                    child: _SmallMetric(
                        title: avgTitle,
                        value: _formatQty(avg),
                        suffix: _mixedUnits(filtered))),
                const SizedBox(width: 10),
                Expanded(
                    child: _SmallMetric(
                        title: 'Maior consumo',
                        value: _formatQty(maxValue),
                        suffix: _mixedUnits(filtered))),
              ]),
              const SizedBox(height: 10),
              _SmallMetric(
                  title: 'Total no período',
                  value: _formatQty(total),
                  suffix: _mixedUnits(filtered)),
            ],
          ]),
    );
  }
}

class ConsumptionMaterialDetailPage extends StatefulWidget {
  const ConsumptionMaterialDetailPage(
      {super.key,
      required this.rows,
      required this.teams,
      required this.itemId,
      this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String itemId;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialDetailPage> createState() =>
      _ConsumptionMaterialDetailPageState();
}

class _ConsumptionMaterialDetailPageState
    extends State<ConsumptionMaterialDetailPage> {
  late String? teamId = widget.initialTeamId;
  @override
  Widget build(BuildContext context) {
    final itemRows = widget.rows
        .where((r) =>
            r['item_id']?.toString() == widget.itemId &&
            (teamId == null || r['origin_team_id']?.toString() == teamId))
        .toList();
    final item = itemRows.isEmpty ? null : itemRows.first['items'] as Map?;
    final currentTrend = _monthlyTrend(itemRows, 3);
    final previousTrend = _monthlyTrend(itemRows, 6).take(3).toList();
    final currentTotal =
        currentTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    final previousTotal =
        previousTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes do material')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            Row(children: [
              Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                      color: const Color(0xFF0C3766),
                      borderRadius: BorderRadius.circular(14)),
                  child: const Icon(Icons.blur_linear_rounded,
                      size: 38, color: Color(0xFF248BFF))),
              const SizedBox(width: 14),
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Text(item?['name']?.toString() ?? 'Material',
                        style: const TextStyle(
                            fontWeight: FontWeight.w900, fontSize: 20)),
                    Text('Código: ${item?['code'] ?? ''}',
                        style: const TextStyle(color: Colors.white54)),
                    const SizedBox(height: 5),
                    if ((item?['category']?.toString() ?? '').isNotEmpty)
                      Chip(
                          label: Text(item!['category'].toString()),
                          visualDensity: VisualDensity.compact)
                  ])),
            ]),
            const SizedBox(height: 14),
            _teamDropdown(
                widget.teams, teamId, (v) => setState(() => teamId = v)),
            const SizedBox(height: 14),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                              'Consumo de ${item?['name'] ?? 'material'} (${item?['unit'] ?? 'un'})',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 16),
                          SizedBox(
                              height: 250,
                              child: ConsumptionGroupedBarChart(
                                  current: currentTrend,
                                  previous: previousTrend)),
                        ]))),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                  child: _SmallMetric(
                      title: 'Total no período atual',
                      value: _formatQty(currentTotal),
                      suffix: item?['unit']?.toString() ?? 'un')),
              const SizedBox(width: 10),
              Expanded(
                  child: _SmallMetric(
                      title: 'Total no período anterior',
                      value: _formatQty(previousTotal),
                      suffix: item?['unit']?.toString() ?? 'un'))
            ]),
            const SizedBox(height: 10),
            _MetricCard(
                eyebrow: 'VARIAÇÃO NO PERÍODO',
                title: '',
                value:
                    '${_percentChange(currentTotal, previousTotal)?.abs().toStringAsFixed(1) ?? '0.0'}%',
                suffix: '',
                change: _percentChange(currentTotal, previousTotal),
                comparisonText: 'comparado aos 3 meses anteriores'),
          ]),
    );
  }
}

class ConsumptionTeamsComparePage extends StatefulWidget {
  const ConsumptionTeamsComparePage(
      {super.key, required this.rows, required this.teams});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  @override
  State<ConsumptionTeamsComparePage> createState() =>
      _ConsumptionTeamsComparePageState();
}

class _ConsumptionTeamsComparePageState
    extends State<ConsumptionTeamsComparePage> {
  String period = 'month';
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = _periodStart(now, period), end = _periodEnd(now, period);
    final current = _filterConsumption(widget.rows, null, start, end);
    final teamTotals = <Map<String, dynamic>>[];
    for (final t in widget.teams) {
      final qty = _sumConsumption(current
          .where((r) => r['origin_team_id']?.toString() == t.id)
          .toList());
      teamTotals.add({'name': t.name, 'qty': qty});
    }
    teamTotals
        .sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
    final ranking = _groupMaterials(current, const []);
    return Scaffold(
      appBar: AppBar(title: const Text('Comparativo entre equipes')),
      body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
          children: [
            DropdownButtonFormField<String>(
                initialValue: period,
                decoration: const InputDecoration(
                    labelText: 'Período',
                    prefixIcon: Icon(Icons.calendar_month_outlined)),
                items: const [
                  DropdownMenuItem(value: 'week', child: Text('Esta semana')),
                  DropdownMenuItem(value: 'month', child: Text('Este mês'))
                ],
                onChanged: (v) => setState(() => period = v ?? 'month')),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(
                  child: _SmallMetric(
                      title: teamTotals.isEmpty
                          ? 'Equipe'
                          : teamTotals.first['name'].toString(),
                      value: _formatQty(teamTotals.isEmpty
                          ? 0
                          : teamTotals.first['qty'] as double),
                      suffix: _mixedUnits(current))),
              const SizedBox(width: 10),
              Expanded(
                  child: _SmallMetric(
                      title: 'Todas as equipes',
                      value: _formatQty(_sumConsumption(current)),
                      suffix: _mixedUnits(current))),
            ]),
            const SizedBox(height: 12),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Consumo por equipe',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 16),
                          SizedBox(
                              height: 240,
                              child:
                                  ConsumptionHorizontalBars(data: teamTotals)),
                        ]))),
            const SizedBox(height: 12),
            Card(
                child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Ranking de materiais (geral da empresa)',
                              style: TextStyle(
                                  fontWeight: FontWeight.w900, fontSize: 16)),
                          const SizedBox(height: 8),
                          for (int i = 0; i < ranking.length && i < 5; i++)
                            _RankingRow(index: i, data: ranking[i]),
                        ]))),
          ]),
    );
  }
}

Widget _teamDropdown(
        List<Team> teams, String? value, ValueChanged<String?> onChanged) =>
    DropdownButtonFormField<String?>(
      initialValue: value,
      decoration: const InputDecoration(
          labelText: 'Equipe', prefixIcon: Icon(Icons.group_outlined)),
      items: [
        const DropdownMenuItem<String?>(
            value: null, child: Text('Todas as equipes')),
        ...teams.map((t) => DropdownMenuItem<String?>(
            value: t.id, child: Text(t.name, overflow: TextOverflow.ellipsis)))
      ],
      onChanged: onChanged,
    );

DateTime _periodStart(DateTime now, String period) {
  if (period == 'week')
    return DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: now.weekday - 1));
  return DateTime(now.year, now.month, 1);
}

DateTime _periodEnd(DateTime now, String period) => period == 'week'
    ? _periodStart(now, period).add(const Duration(days: 7))
    : DateTime(now.year, now.month + 1, 1);
DateTime _rowDate(Map<String, dynamic> r) =>
    DateTime.tryParse(r['created_at']?.toString() ?? '')?.toLocal() ??
    DateTime(1970);
List<Map<String, dynamic>> _filterConsumption(List<Map<String, dynamic>> rows,
        String? teamId, DateTime start, DateTime end) =>
    rows.where((r) {
      final d = _rowDate(r);
      return (teamId == null || r['origin_team_id']?.toString() == teamId) &&
          !d.isBefore(start) &&
          d.isBefore(end);
    }).toList();
double _sumConsumption(List<Map<String, dynamic>> rows) => rows.fold<double>(
    0, (a, r) => a + ((r['quantity'] as num?)?.toDouble() ?? 0));
double? _percentChange(double current, double previous) =>
    previous == 0 ? null : ((current - previous) / previous * 100);
String _formatQty(double v) =>
    v.toStringAsFixed(v % 1 == 0 ? 0 : 2).replaceAll('.', ',');
String _dateBr(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
String _consumptionPeriodLabel(int days) => days == 7
    ? '7 DIAS'
    : days == 30
        ? '30 DIAS'
        : days == 90
            ? '3 MESES'
            : '6 MESES';
String _consumptionScaleLabel(int days) => days == 7
    ? 'por dia'
    : days == 30
        ? 'a cada 5 dias'
        : days == 90
            ? 'a cada 15 dias'
            : 'por mês';
List<Map<String, dynamic>> _consumptionTrend(List<Map<String, dynamic>> rows,
    DateTime start, DateTime end, int periodDays) {
  if (periodDays >= 180) {
    final out = <Map<String, dynamic>>[];
    var cursor = DateTime(start.year, start.month, 1);
    while (cursor.isBefore(end)) {
      final next = DateTime(cursor.year, cursor.month + 1, 1);
      final bucketStart = cursor.isBefore(start) ? start : cursor;
      final bucketEnd = next.isAfter(end) ? end : next;
      if (bucketStart.isBefore(bucketEnd)) {
        out.add({
          'label':
              '${cursor.month.toString().padLeft(2, '0')}/${cursor.year.toString().substring(2)}',
          'qty': _sumConsumption(
              _filterConsumption(rows, null, bucketStart, bucketEnd))
        });
      }
      cursor = next;
    }
    return out;
  }
  final bucketDays = periodDays <= 7
      ? 1
      : periodDays <= 30
          ? 5
          : 15;
  final out = <Map<String, dynamic>>[];
  var cursor = start;
  while (cursor.isBefore(end)) {
    final next = cursor.add(Duration(days: bucketDays));
    final bucketEnd = next.isAfter(end) ? end : next;
    final label = bucketDays == 1
        ? '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}'
        : '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}';
    out.add({
      'label': label,
      'qty': _sumConsumption(_filterConsumption(rows, null, cursor, bucketEnd))
    });
    cursor = next;
  }
  return out;
}

String _mixedUnits(List<Map<String, dynamic>> rows) {
  final units = <String>{};
  for (final r in rows) {
    final u = (r['items'] as Map?)?['unit']?.toString();
    if (u != null && u.isNotEmpty) units.add(u);
  }
  if (units.isEmpty) return 'un/kg/L';
  return units.take(3).join('/');
}

List<Map<String, dynamic>> _groupMaterials(
    List<Map<String, dynamic>> current, List<Map<String, dynamic>> previous) {
  final grouped = <String, Map<String, dynamic>>{};
  for (final r in [...current, ...previous]) {
    final id = r['item_id']?.toString() ?? '';
    final item = r['items'] as Map?;
    grouped.putIfAbsent(
        id,
        () => {
              'id': id,
              'code': item?['code']?.toString() ?? '',
              'name': item?['name']?.toString() ?? 'Material',
              'unit': item?['unit']?.toString() ?? 'un',
              'category': item?['category']?.toString() ?? 'Outros',
              'qty': 0.0,
              'prev': 0.0
            });
  }
  for (final r in current) {
    final id = r['item_id']?.toString() ?? '';
    if (grouped[id] != null)
      grouped[id]!['qty'] = (grouped[id]!['qty'] as double) +
          ((r['quantity'] as num?)?.toDouble() ?? 0);
  }
  for (final r in previous) {
    final id = r['item_id']?.toString() ?? '';
    if (grouped[id] != null)
      grouped[id]!['prev'] = (grouped[id]!['prev'] as double) +
          ((r['quantity'] as num?)?.toDouble() ?? 0);
  }
  final out = grouped.values.where((g) => (g['qty'] as double) > 0).toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}

String _consumptionCategory(Map<String, dynamic> row) {
  final item = row['items'] as Map?;
  final configured = item?['category']?.toString().trim() ?? '';
  if (configured.isNotEmpty) return configured;
  final name = item?['name']?.toString().toLowerCase() ?? '';
  if (name.contains('disco') ||
      name.contains('lixa') ||
      name.contains('abrasiv')) return 'Abrasivos';
  if (name.contains('eletrodo') ||
      name.contains('arame') ||
      name.contains('solda')) return 'Consumíveis de soldagem';
  if (name.contains('gás') ||
      name.contains('gas') ||
      name.contains('oxigênio') ||
      name.contains('argon')) return 'Gases';
  return 'Outros';
}

List<Map<String, dynamic>> _groupCategories(List<Map<String, dynamic>> rows) {
  final m = <String, double>{};
  for (final r in rows) {
    final c = _consumptionCategory(r);
    m[c] = (m[c] ?? 0) + ((r['quantity'] as num?)?.toDouble() ?? 0);
  }
  final total = m.values.fold<double>(0, (a, b) => a + b);
  final out = m.entries
      .map((e) => {
            'name': e.key,
            'qty': e.value,
            'pct': total == 0 ? 0.0 : e.value / total * 100
          })
      .toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}

List<Map<String, dynamic>> _monthlyTrend(
    List<Map<String, dynamic>> rows, int months) {
  final now = DateTime.now();
  final out = <Map<String, dynamic>>[];
  for (int i = months - 1; i >= 0; i--) {
    final m = DateTime(now.year, now.month - i, 1);
    final n = DateTime(now.year, now.month - i + 1, 1);
    out.add({
      'label':
          '${m.month.toString().padLeft(2, '0')}/${m.year.toString().substring(2)}',
      'qty': _sumConsumption(_filterConsumption(rows, null, m, n))
    });
  }
  return out;
}

const _consumptionColors = [
  Color(0xFF2B8CFF),
  Color(0xFF59B85B),
  Color(0xFFFFA726),
  Color(0xFF8E63E7),
  Color(0xFF7B8CA2),
  Color(0xFF27C5C3)
];

class _MetricCard extends StatelessWidget {
  const _MetricCard(
      {required this.eyebrow,
      required this.title,
      required this.value,
      required this.suffix,
      required this.change,
      required this.comparisonText});
  final String eyebrow, title, value, suffix, comparisonText;
  final double? change;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(14),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(eyebrow,
                style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    if (title.isNotEmpty)
                      Text(title, style: const TextStyle(fontSize: 12)),
                    Text(value,
                        style: const TextStyle(
                            fontSize: 29, fontWeight: FontWeight.w900)),
                    if (suffix.isNotEmpty)
                      Text(suffix,
                          style: const TextStyle(
                              color: Colors.white54, fontSize: 11))
                  ])),
              if (change != null)
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(
                      '${change! >= 0 ? '↑' : '↓'} ${change!.abs().toStringAsFixed(1)}%',
                      style: TextStyle(
                          color: change! > 0
                              ? const Color(0xFFFF5A52)
                              : const Color(0xFF73D84E),
                          fontWeight: FontWeight.w900,
                          fontSize: 18)),
                  Text(comparisonText,
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 10))
                ])
              else
                const Text('Sem base anterior',
                    style: TextStyle(color: Colors.white38, fontSize: 11)),
            ]),
          ])));
}

class _SmallMetric extends StatelessWidget {
  const _SmallMetric(
      {required this.title, required this.value, required this.suffix});
  final String title, value, suffix;
  @override
  Widget build(BuildContext context) => Card(
      child: Padding(
          padding: const EdgeInsets.all(13),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(color: Colors.white60, fontSize: 11)),
            const SizedBox(height: 5),
            Text(value,
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 21)),
            Text(suffix,
                style: const TextStyle(color: Colors.white38, fontSize: 10))
          ])));
}

class _CategoryLegendRow extends StatelessWidget {
  const _CategoryLegendRow({required this.index, required this.data});
  final int index;
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
                color: _consumptionColors[index % _consumptionColors.length],
                borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 7),
        Expanded(
            child: Text(data['name'].toString(),
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12))),
        Text('${(data['pct'] as double).toStringAsFixed(0)}%',
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12))
      ]));
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({required this.index, required this.data, this.onTap});
  final int index;
  final Map<String, dynamic> data;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
      onTap: onTap,
      child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                    color:
                        _consumptionColors[index % _consumptionColors.length],
                    borderRadius: BorderRadius.circular(5)),
                child: Text('${index + 1}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 11))),
            const SizedBox(width: 9),
            Expanded(
                child: Text(data['name'].toString(),
                    style: const TextStyle(fontWeight: FontWeight.w700))),
            Text('${_formatQty(data['qty'] as double)} ${data['unit']}',
                style: const TextStyle(fontWeight: FontWeight.w800))
          ])));
}

class _ConsumptionTableRow extends StatelessWidget {
  const _ConsumptionTableRow({required this.data});
  final Map<String, dynamic> data;
  @override
  Widget build(BuildContext context) {
    final q = data['qty'] as double,
        p = data['prev'] as double,
        c = _percentChange(q, p);
    return Container(
        decoration: BoxDecoration(
            border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: .06)))),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(children: [
          Expanded(
              flex: 5,
              child: Text(data['name'].toString(),
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 12))),
          Expanded(
              flex: 2,
              child: Text(_formatQty(q), style: const TextStyle(fontSize: 12))),
          Expanded(
              flex: 2,
              child: Text(data['unit'].toString(),
                  style: const TextStyle(fontSize: 12))),
          Expanded(
              flex: 3,
              child: Text(
                  c == null
                      ? '— 0,0%'
                      : '${c >= 0 ? '↑' : '↓'} ${c.abs().toStringAsFixed(1)}%',
                  textAlign: TextAlign.end,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: c == null
                          ? Colors.white54
                          : c > 0
                              ? const Color(0xFFFF5A52)
                              : const Color(0xFF73D84E))))
        ]));
  }
}

class ConsumptionDonutChart extends StatelessWidget {
  const ConsumptionDonutChart(
      {super.key, required this.data, this.showLabels = false});
  final List<Map<String, dynamic>> data;
  final bool showLabels;
  @override
  Widget build(BuildContext context) => CustomPaint(
      painter: _DonutPainter(data),
      child: showLabels
          ? Align(
              alignment: Alignment.bottomCenter,
              child: Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  alignment: WrapAlignment.center,
                  children: [
                    for (int i = 0; i < data.length && i < 6; i++)
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(
                            width: 8,
                            height: 8,
                            color: _consumptionColors[
                                i % _consumptionColors.length]),
                        const SizedBox(width: 5),
                        Text(
                            '${data[i]['name']} ${(data[i]['pct'] as double).toStringAsFixed(0)}%',
                            style: const TextStyle(fontSize: 10))
                      ])
                  ]))
          : const SizedBox.expand());
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.data);
  final List<Map<String, dynamic>> data;
  @override
  void paint(Canvas canvas, Size size) {
    final total = data.fold<double>(0, (a, e) => a + (e['qty'] as double));
    if (total == 0) return;
    final c = Offset(size.width / 2,
        showCenter(size.height) ? size.height * .42 : size.height / 2);
    final r = (size.shortestSide * .36).clamp(20.0, 88.0).toDouble();
    final rect = Rect.fromCircle(center: c, radius: r);
    var start = -1.57079632679;
    for (int i = 0; i < data.length; i++) {
      final sweep = (data[i]['qty'] as double) / total * 6.28318530718;
      final p = Paint()
        ..color = _consumptionColors[i % _consumptionColors.length]
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * .38
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, start, sweep, false, p);
      start += sweep;
    }
  }

  bool showCenter(double h) => h > 180;
  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) => true;
}

class ConsumptionLineChart extends StatelessWidget {
  const ConsumptionLineChart({super.key, required this.data});
  final List<Map<String, dynamic>> data;
  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _LinePainter(data), child: const SizedBox.expand());
}

class _LinePainter extends CustomPainter {
  _LinePainter(this.data);
  final List<Map<String, dynamic>> data;
  @override
  void paint(Canvas canvas, Size size) {
    final values = data.map((e) => e['qty'] as double).toList();
    final max =
        values.isEmpty ? 1.0 : values.fold<double>(0, (a, b) => a > b ? a : b);
    final left = 34.0, right = 10.0, top = 12.0, bottom = 28.0;
    final w = size.width - left - right, h = size.height - top - bottom;
    final grid = Paint()
      ..color = Colors.white.withValues(alpha: .07)
      ..strokeWidth = 1;
    for (int i = 0; i < 5; i++) {
      final y = top + h * i / 4;
      canvas.drawLine(Offset(left, y), Offset(left + w, y), grid);
    }
    if (data.isEmpty) return;
    final path = Path();
    final fill = Path();
    for (int i = 0; i < data.length; i++) {
      final x = left + (data.length == 1 ? 0.0 : w * i / (data.length - 1));
      final y =
          top + h - (max == 0 ? 0.0 : (data[i]['qty'] as double) / max * h);
      if (i == 0) {
        path.moveTo(x, y);
        fill.moveTo(x, top + h);
        fill.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fill.lineTo(x, y);
      }
      final tp = TextPainter(
          text: TextSpan(
              text: data[i]['label'].toString(),
              style: const TextStyle(fontSize: 9, color: Colors.white54)),
          textDirection: TextDirection.ltr)
        ..layout();
      tp.paint(canvas, Offset(x - tp.width / 2, top + h + 8));
      final vp = TextPainter(
          text: TextSpan(
              text: _formatQty(data[i]['qty'] as double),
              style: const TextStyle(
                  fontSize: 9,
                  color: Colors.white70,
                  fontWeight: FontWeight.w700)),
          textDirection: TextDirection.ltr)
        ..layout();
      vp.paint(canvas, Offset(x - vp.width / 2, y - 17));
    }
    fill.lineTo(left + w, top + h);
    fill.close();
    canvas.drawPath(
        fill,
        Paint()
          ..shader = LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF258CFF).withValues(alpha: .35),
                const Color(0xFF258CFF).withValues(alpha: .02)
              ]).createShader(Rect.fromLTWH(left, top, w, h)));
    canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xFF258CFF)
          ..strokeWidth = 2.2
          ..style = PaintingStyle.stroke);
    for (int i = 0; i < data.length; i++) {
      final x = left + (data.length == 1 ? 0.0 : w * i / (data.length - 1));
      final y =
          top + h - (max == 0 ? 0.0 : (data[i]['qty'] as double) / max * h);
      canvas.drawCircle(
          Offset(x, y), 4, Paint()..color = const Color(0xFF258CFF));
      canvas.drawCircle(Offset(x, y), 2, Paint()..color = Colors.white);
    }
  }

  @override
  bool shouldRepaint(covariant _LinePainter oldDelegate) => true;
}

class ConsumptionGroupedBarChart extends StatelessWidget {
  const ConsumptionGroupedBarChart(
      {super.key, required this.current, required this.previous});
  final List<Map<String, dynamic>> current, previous;
  @override
  Widget build(BuildContext context) => CustomPaint(
      painter: _GroupedBarPainter(current, previous),
      child: const SizedBox.expand());
}

class _GroupedBarPainter extends CustomPainter {
  _GroupedBarPainter(this.current, this.previous);
  final List<Map<String, dynamic>> current, previous;
  @override
  void paint(Canvas canvas, Size size) {
    final n = current.length;
    if (n == 0) return;
    final vals = [
      ...current.map((e) => e['qty'] as double),
      ...previous.map((e) => e['qty'] as double)
    ];
    final max = vals.fold<double>(0, (a, b) => a > b ? a : b);
    final base = size.height - 28,
        top = 18.0,
        h = base - top,
        groupW = size.width / n;
    for (int i = 0; i < n; i++) {
      final a = current[i]['qty'] as double,
          b = i < previous.length ? previous[i]['qty'] as double : 0.0;
      final double bhA = max == 0 ? 0.0 : a / max * h,
          bhB = max == 0 ? 0.0 : b / max * h;
      final x = i * groupW + groupW * .25;
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(x, base - bhA, groupW * .22, bhA),
              const Radius.circular(4)),
          Paint()..color = const Color(0xFF2B8CFF));
      canvas.drawRRect(
          RRect.fromRectAndRadius(
              Rect.fromLTWH(x + groupW * .27, base - bhB, groupW * .22, bhB),
              const Radius.circular(4)),
          Paint()..color = const Color(0xFF687584));
      final tp = TextPainter(
          text: TextSpan(
              text: current[i]['label'].toString(),
              style: const TextStyle(fontSize: 9, color: Colors.white54)),
          textDirection: TextDirection.ltr)
        ..layout();
      tp.paint(canvas, Offset(i * groupW + (groupW - tp.width) / 2, base + 8));
    }
  }

  @override
  bool shouldRepaint(covariant _GroupedBarPainter oldDelegate) => true;
}

class ConsumptionHorizontalBars extends StatelessWidget {
  const ConsumptionHorizontalBars({super.key, required this.data});
  final List<Map<String, dynamic>> data;
  @override
  Widget build(BuildContext context) {
    final max = data.fold<double>(
        0, (a, e) => (e['qty'] as double) > a ? (e['qty'] as double) : a);
    return Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      for (int i = 0; i < data.length; i++)
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(children: [
              SizedBox(
                  width: 115,
                  child: Text(data[i]['name'].toString(),
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11))),
              Expanded(
                  child: LayoutBuilder(
                      builder: (context, c) => Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                              height: 24,
                              width: max == 0
                                  ? 2.0
                                  : c.maxWidth *
                                      (data[i]['qty'] as double) /
                                      max,
                              decoration: BoxDecoration(
                                  color: i == 1
                                      ? const Color(0xFF2B8CFF)
                                      : i == 0
                                          ? const Color(0xFF687584)
                                          : _consumptionColors[
                                              i % _consumptionColors.length],
                                  borderRadius: BorderRadius.circular(3)))))),
              const SizedBox(width: 7),
              SizedBox(
                  width: 52,
                  child: Text(_formatQty(data[i]['qty'] as double),
                      style: const TextStyle(
                          fontSize: 10, fontWeight: FontWeight.w800)))
            ]))
    ]);
  }
}

class HistoryPage extends StatefulWidget {
  const HistoryPage(
      {super.key,
      required this.repo,
      required this.stream,
      required this.isAdmin});
  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;
  final bool isAdmin;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  final search = TextEditingController();
  final Set<String> movementFilters = {};
  void reload() => setState(() {});

  Future<void> _showHistoryFilters(BuildContext context) async {
    final draft = Set<String>.from(movementFilters);
    final result = await showModalBottomSheet<Set<String>>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) {
          const options = <(String, String, IconData)>[
            ('entry', 'Entrada de material', Icons.move_to_inbox_outlined),
            ('consumption', 'Consumo de material', Icons.construction_rounded),
            (
              'replenishment',
              'Reposição COSEM → equipe',
              Icons.inventory_2_outlined
            ),
            (
              'transfer',
              'Transferência de equipamento',
              Icons.swap_horiz_rounded
            ),
            ('adjustment', 'Ajuste de estoque', Icons.tune_rounded),
            ('maintenance', 'Manutenção', Icons.build_outlined),
            ('return', 'Retorno', Icons.keyboard_return_rounded),
          ];
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Filtrar histórico',
                      style:
                          TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  const Text(
                      'Marque uma ou mais operações. Sem seleção, o histórico mostra tudo.',
                      style: TextStyle(color: Colors.white60)),
                  const SizedBox(height: 10),
                  for (final option in options)
                    CheckboxListTile(
                      value: draft.contains(option.$1),
                      secondary: Icon(option.$3),
                      title: Text(option.$2),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      onChanged: (checked) => setSheet(() {
                        if (checked ?? false) {
                          draft.add(option.$1);
                        } else {
                          draft.remove(option.$1);
                        }
                      }),
                    ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                        child: OutlinedButton(
                            onPressed: () => setSheet(draft.clear),
                            child: const Text('Limpar'))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: FilledButton(
                            onPressed: () => Navigator.pop(context, draft),
                            child: const Text('Aplicar'))),
                  ]),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (result != null && mounted)
      setState(() {
        movementFilters
          ..clear()
          ..addAll(result);
      });
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.repo.watchDashboard(),
      builder: (context, dSnap) {
        if (!dSnap.hasData)
          return const Center(child: CircularProgressIndicator());
        final teams = dSnap.data!.teams;

        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.repo.fetchHistory(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData)
              return const Center(child: CircularProgressIndicator());
            final q = search.text.trim().toLowerCase();
            final rows = snap.data!
                .where((row) => q.isEmpty || historySearchText(row).contains(q))
                .where((row) =>
                    movementFilters.isEmpty ||
                    movementFilters
                        .contains(row['movement_type']?.toString() ?? ''))
                .toList();

            return RefreshIndicator(
              onRefresh: () async {
                reload();
                await widget.repo.refreshDashboard();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
                children: [
                  TextField(
                    controller: search,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText:
                          'Pesquisar histórico por nome, código ou movimentação',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: search.text.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Limpar pesquisa',
                              onPressed: () {
                                search.clear();
                                setState(() {});
                              },
                              icon: const Icon(Icons.close),
                            ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _showHistoryFilters(context),
                          icon: const Icon(Icons.tune_rounded),
                          label: Text(movementFilters.isEmpty
                              ? 'Filtrar histórico'
                              : 'Filtros (${movementFilters.length})'),
                        ),
                      ),
                      if (movementFilters.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        IconButton(
                          tooltip: 'Limpar filtros',
                          onPressed: () => setState(movementFilters.clear),
                          icon: const Icon(Icons.filter_alt_off_outlined),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (snap.data!.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 50),
                      child: EmptyState(
                        icon: Icons.history,
                        title: 'Histórico vazio',
                        subtitle:
                            'As entradas e movimentações aparecerão aqui.',
                      ),
                    )
                  else if (rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: EmptyState(
                        icon: Icons.search_off,
                        title: 'Nenhuma movimentação encontrada',
                        subtitle:
                            'Tente outro nome, código, equipe ou tipo de movimentação.',
                      ),
                    )
                  else
                    for (final row in rows)
                      Builder(builder: (context) {
                        final isMaterial = row['_kind'] == 'material';
                        final title = isMaterial
                            ? ((row['items'] as Map?)?['name']?.toString() ??
                                'Material')
                            : (((row['assets'] as Map?)?['items']
                                        as Map?)?['name']
                                    ?.toString() ??
                                'Equipamento');
                        final item = isMaterial
                            ? row['items'] as Map?
                            : (row['assets'] as Map?)?['items'] as Map?;
                        final code = item?['code']?.toString() ?? '';
                        final assetCode = (row['assets'] as Map?)?['asset_code']
                                ?.toString() ??
                            '';
                        final origin =
                            (row['origin'] as Map?)?['name']?.toString();
                        final destination =
                            (row['destination'] as Map?)?['name']?.toString();
                        final movementType =
                            row['movement_type']?.toString() ?? '';
                        final accent =
                            historyAccentColor(isMaterial, movementType);
                        final mainAction = [
                          movementLabel(movementType),
                          if (origin != null) origin,
                          if (destination != null) destination,
                        ].join(' → ');

                        return Card(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(
                                color: accent.withValues(alpha: .55)),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () => showHistoryDetails(context, row),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    width: 54,
                                    child: Align(
                                      alignment: Alignment.topCenter,
                                      child: HistoryMovementIcon(
                                        isMaterial: isMaterial,
                                        movementType: movementType,
                                        color: accent,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(title,
                                            style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w900)),
                                        const SizedBox(height: 3),
                                        Text(
                                          [
                                            if (code.isNotEmpty) code,
                                            if (!isMaterial &&
                                                assetCode.isNotEmpty)
                                              assetCode
                                          ].join(' • '),
                                          style: TextStyle(
                                              color: accent,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(mainAction,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w700)),
                                        if (isMaterial) ...[
                                          const SizedBox(height: 3),
                                          Text(
                                              'Quantidade: ${row['quantity'] ?? 0}'),
                                        ],
                                        const SizedBox(height: 7),
                                        Row(
                                          children: [
                                            const Icon(Icons.schedule,
                                                size: 15,
                                                color: Colors.white54),
                                            const SizedBox(width: 5),
                                            Text(
                                                formatHistoryDateTime(
                                                    row['created_at']),
                                                style: const TextStyle(
                                                    color: Colors.white60,
                                                    fontSize: 12)),
                                          ],
                                        ),
                                        if (row['note'] != null &&
                                            row['note']
                                                .toString()
                                                .trim()
                                                .isNotEmpty) ...[
                                          const SizedBox(height: 5),
                                          Text(row['note'].toString(),
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                  color: Colors.white70)),
                                        ],
                                        const SizedBox(height: 5),
                                        const Text('Toque para ver os detalhes',
                                            style: TextStyle(
                                                color: Colors.white38,
                                                fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  if (widget.isAdmin)
                                    PopupMenuButton<String>(
                                      onSelected: (action) async {
                                        if (action == 'edit') {
                                          try {
                                            if (isMaterial) {
                                              await showMaterialHistoryEdit(
                                                  context,
                                                  widget.repo,
                                                  teams,
                                                  row);
                                            } else {
                                              await showAssetHistoryEdit(
                                                  context,
                                                  widget.repo,
                                                  teams,
                                                  row);
                                            }
                                            reload();
                                          } catch (e) {
                                            if (context.mounted)
                                              showError(context, e);
                                          }
                                        } else if (action == 'delete') {
                                          final yes = await confirm(
                                            context,
                                            'Excluir registro?',
                                            'A exclusão também desfaz o efeito desta movimentação no estoque/localização.',
                                          );
                                          if (yes == true) {
                                            try {
                                              if (isMaterial) {
                                                await widget.repo
                                                    .deleteMaterialHistory(
                                                        row['id'].toString());
                                              } else {
                                                await widget.repo
                                                    .deleteAssetHistory(
                                                        row['id'].toString());
                                              }
                                              reload();
                                            } catch (e) {
                                              if (context.mounted)
                                                showError(context, e);
                                            }
                                          }
                                        }
                                      },
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(
                                            value: 'edit',
                                            child: Text('Corrigir')),
                                        PopupMenuItem(
                                            value: 'delete',
                                            child: Text('Excluir')),
                                      ],
                                    )
                                  else
                                    const Padding(
                                      padding:
                                          EdgeInsets.only(top: 18, right: 6),
                                      child: Icon(Icons.chevron_right,
                                          color: Colors.white38),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                ],
              ),
            );
          },
        );
      },
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

Future<void> showMaterialHistoryEdit(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
  final actionLock = UiActionLock.acquire(context, 'showMaterialHistoryEdit');
  if (actionLock == null) return;
  try {
    final type = row['movement_type']?.toString() ?? 'entry';
    final qty = TextEditingController(text: row['quantity']?.toString() ?? '1');
    final note = TextEditingController(text: row['note']?.toString() ?? '');
    String? originId = row['origin_team_id']?.toString();
    String? destinationId = row['destination_team_id']?.toString();
    String? error;
    bool busy = false;

    await showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: const Text('Corrigir movimentação'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: qty,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Quantidade'),
                ),
                if (type == 'transfer' ||
                    type == 'exit' ||
                    type == 'maintenance') ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: originId,
                    decoration:
                        const InputDecoration(labelText: 'Equipe de origem'),
                    items: teams
                        .map((t) =>
                            DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged:
                        busy ? null : (v) => setLocal(() => originId = v),
                  ),
                ],
                if (type == 'transfer' ||
                    type == 'entry' ||
                    type == 'return') ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: destinationId,
                    decoration:
                        const InputDecoration(labelText: 'Equipe de destino'),
                    items: teams
                        .map((t) =>
                            DropdownMenuItem(value: t.id, child: Text(t.name)))
                        .toList(),
                    onChanged:
                        busy ? null : (v) => setLocal(() => destinationId = v),
                  ),
                ],
                const SizedBox(height: 10),
                TextField(
                  controller: note,
                  decoration: const InputDecoration(labelText: 'Observação'),
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
                      final q = int.tryParse(qty.text);
                      if (q == null || q <= 0) {
                        setLocal(() => error = 'Quantidade inválida.');
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await repo.updateMaterialHistory(
                          id: row['id'].toString(),
                          quantity: q,
                          originTeamId: originId,
                          destinationTeamId: destinationId,
                          note: note.text,
                        );
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        setLocal(() => error = friendlyError(e));
                      } finally {
                        if (dialogContext.mounted) setLocal(() => busy = false);
                      }
                    },
              child: const Text('Salvar correção'),
            ),
          ],
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}

Future<void> showAssetHistoryEdit(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
  final actionLock = UiActionLock.acquire(context, 'showAssetHistoryEdit');
  if (actionLock == null) return;
  try {
    String? teamId = row['destination_team_id']?.toString();
    String status = row['new_status']?.toString() ?? 'available';
    final note = TextEditingController(text: row['note']?.toString() ?? '');
    bool busy = false;
    String? error;

    await showDialog(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: const Text('Corrigir equipamento'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe correta'),
                items: teams
                    .map((t) =>
                        DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setLocal(() => teamId = v),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: const [
                  DropdownMenuItem(
                      value: 'available', child: Text('Disponível')),
                  DropdownMenuItem(value: 'in_use', child: Text('Em uso')),
                  DropdownMenuItem(
                      value: 'maintenance', child: Text('Manutenção')),
                  DropdownMenuItem(value: 'damaged', child: Text('Danificado')),
                  DropdownMenuItem(value: 'lost', child: Text('Perdido')),
                  DropdownMenuItem(value: 'retired', child: Text('Baixado')),
                ],
                onChanged: busy ? null : (v) => setLocal(() => status = v!),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: note,
                decoration: const InputDecoration(labelText: 'Observação'),
              ),
              if (error != null)
                Text(error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
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
                      if (teamId == null) {
                        setLocal(() => error = 'Selecione a equipe.');
                        return;
                      }
                      setLocal(() {
                        busy = true;
                        error = null;
                      });
                      try {
                        await repo.updateAssetHistory(
                          id: row['id'].toString(),
                          destinationTeamId: teamId!,
                          status: status,
                          note: note.text,
                        );
                        if (dialogContext.mounted) Navigator.pop(dialogContext);
                      } catch (e) {
                        setLocal(() => error = friendlyError(e));
                      } finally {
                        if (dialogContext.mounted) setLocal(() => busy = false);
                      }
                    },
              child: const Text('Salvar correção'),
            ),
          ],
        ),
      ),
    );
  } finally {
    actionLock.release();
  }
}
