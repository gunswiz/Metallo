part of '../../app.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.profile});
  final Map<String, dynamic> profile;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 2;
  OverlayEntry? _guideOverlay;
  late final DashboardRepository dashboardRepository =
      DashboardRepository(Supabase.instance.client);
  late final CatalogRepository catalogRepository =
      CatalogRepository(Supabase.instance.client, dashboardRepository);
  late final EpiRepository epiRepository =
      EpiRepository(Supabase.instance.client, dashboardRepository);
  late final AdminRepository adminRepository =
      AdminRepository(Supabase.instance.client, dashboardRepository);
  late final MovementRepository movementRepository =
      MovementRepository(Supabase.instance.client, dashboardRepository);
  late final Stream<DashboardSnapshot> dashboard =
      dashboardRepository.watchDashboard();

  String get role => widget.profile['role']?.toString() ?? 'collaborator';
  String? get userTeamId => widget.profile['team_id']?.toString();
  bool get isAdmin => role == 'admin';
  bool get canOperate =>
      role == 'admin' || role == 'engineer' || role == 'leader';

  String get _tutorialKey =>
      'metallo_tutorial_v1_${Supabase.instance.client.auth.currentUser?.id ?? 'local'}_$role';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startupChecks());
  }

  Future<void> _startupChecks() async {
    await _showTutorialIfNeeded();
    if (mounted) await AppUpdateService.showIfAvailable(context);
  }

  Future<void> _showTutorialIfNeeded() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted || (prefs.getBool(_tutorialKey) ?? false)) return;
    await showMetalloTutorial(context, role: role, onNavigate: (page) {
      if (mounted) setState(() => index = page);
    });
    await prefs.setBool(_tutorialKey, true);
  }

  Future<void> _replayTutorial() async {
    await showMetalloTutorial(context, role: role, onNavigate: (page) {
      if (mounted) setState(() => index = page);
    });
  }

  Future<void> _startGuidedPractice(HelpTopic topic) async {
    Navigator.of(context).popUntil((route) => route.isFirst);
    final title = topic.title.toLowerCase();
    setState(() => index = title.contains('equipamento')
        ? 1
        : title.contains('material') || title.contains('consumo')
            ? 0
            : title.contains('histórico')
                ? 4
                : 2);
    if (topic.restricted) {
      final data = await dashboardRepository.fetchDashboard();
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => EpiManagementShell(
              repo: epiRepository,
              adminRepository: adminRepository,
              teams: data.teams,
              role: role)));
    }
    _guideOverlay?.remove();
    _guideOverlay = OverlayEntry(
      builder: (overlayContext) => Positioned(
        left: 12,
        right: 12,
        top: MediaQuery.of(overlayContext).padding.top + 64,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(overlayContext).height * .6,
          ),
          child: GuidedPracticeCard(
            steps: topic.steps,
            initialStep: topic.steps.length > 1 ? 1 : 0,
            onClose: () {
              _guideOverlay?.remove();
              _guideOverlay = null;
            },
          ),
        ),
      ),
    );
    if (mounted) Overlay.of(context, rootOverlay: true).insert(_guideOverlay!);
  }

  @override
  void dispose() {
    _guideOverlay?.remove();
    dashboardRepository.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      MaterialsPage(
        catalogRepository: catalogRepository,
        movementRepository: movementRepository,
        stream: dashboard,
        role: role,
        userTeamId: userTeamId,
      ),
      EquipmentPage(
        catalogRepository: catalogRepository,
        movementRepository: movementRepository,
        stream: dashboard,
        role: role,
        userTeamId: userTeamId,
      ),
      DashboardPage(
          dashboardRepository: dashboardRepository,
          adminRepository: adminRepository,
          epiRepository: epiRepository,
          movementRepository: movementRepository,
          stream: dashboard,
          role: role,
          userTeamId: userTeamId),
      ConsumptionPage(
          movementRepository: movementRepository,
          dashboardRepository: dashboardRepository,
          stream: dashboard),
      HistoryPage(
          movementRepository: movementRepository,
          dashboardRepository: dashboardRepository,
          stream: dashboard,
          isAdmin: isAdmin),
    ];

    final name = widget.profile['full_name']?.toString() ?? 'Usuário';

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Expanded(
              child: Text(
                'Olá, ${firstName(name)}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 8),
            RoleBadge(role: role),
          ],
        ),
        actions: [
          if (isAdmin)
            IconButton(
              tooltip: 'Administração',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => AdministrationPage(repo: adminRepository),
                ),
              ),
              icon: const Icon(Icons.admin_panel_settings_outlined),
            ),
          IconButton(
            tooltip: 'Minha conta',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => AccountSettingsPage(
                      role: role,
                      onReplayTutorial: _replayTutorial,
                      onStartGuidedPractice: _startGuidedPractice)),
            ),
            icon: const Icon(Icons.account_circle_outlined),
          ),
          IconButton(
            tooltip: 'Atualizar',
            onPressed: dashboardRepository.refreshDashboard,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sair',
            onPressed: () => Supabase.instance.client.auth.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined),
            label: 'Materiais',
          ),
          NavigationDestination(
            icon: Icon(Icons.handyman_outlined),
            label: 'Equipamentos',
          ),
          NavigationDestination(
              icon: Icon(Icons.home_outlined), label: 'Início'),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_rounded),
            label: 'Consumo',
          ),
          NavigationDestination(icon: Icon(Icons.history), label: 'Histórico'),
        ],
      ),
    );
  }
}
