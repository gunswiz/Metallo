import 'dart:async';

import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'repository.dart';
import 'validation.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    publishableKey: AppConfig.supabasePublishableKey,
  );
  runApp(const MetalloApp());
}

class MetalloApp extends StatelessWidget {
  const MetalloApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF1687FF),
      brightness: Brightness.dark,
    ).copyWith(
      primary: const Color(0xFF1687FF),
      secondary: const Color(0xFF55A9FF),
      surface: const Color(0xFF111720),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Metallo',
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: scheme,
        scaffoldBackgroundColor: const Color(0xFF05080D),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF05080D),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
        cardTheme: CardThemeData(
          color: const Color(0xFF111720),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF121820),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF2B394B)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: Color(0xFF2B394B)),
          ),
        ),
        navigationBarTheme: const NavigationBarThemeData(
          backgroundColor: Color(0xFF090D13),
          indicatorColor: Color(0xFF123A65),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ),
      builder: (context, child) {
        final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
        return Stack(
          children: [
            Positioned.fill(child: child ?? const SizedBox.shrink()),
            if (!keyboardOpen)
              const Positioned(
                right: 7,
                bottom: 4,
                child: IgnorePointer(
                  child: SafeArea(
                    top: false,
                    left: false,
                    child: Text(
                      'Criado por WM',
                      style: TextStyle(
                        color: Color(0x336F8298),
                        fontSize: 7,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.1,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
      home: const StartupSplash(),
    );
  }
}


class StartupSplash extends StatefulWidget {
  const StartupSplash({super.key});

  @override
  State<StartupSplash> createState() => _StartupSplashState();
}

class _StartupSplashState extends State<StartupSplash> {
  static const _photos = <String>[
    'assets/splash_work_01.jpg',
    'assets/splash_work_02.jpg',
    'assets/splash_work_05.jpg',
    'assets/splash_work_04.jpg',
    'assets/splash_team_final.jpg',
  ];

  Timer? _timer;
  int _index = 0;
  bool _showLogo = false;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 360), (timer) {
      if (!mounted) return;
      if (_index < _photos.length - 1) {
        setState(() => _index++);
        return;
      }
      timer.cancel();
      setState(() => _showLogo = true);
      _timer = Timer(const Duration(milliseconds: 850), () {
        if (mounted) setState(() => _finished = true);
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) return const AuthGate();

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: Image.asset(
              _photos[_index],
              key: ValueKey(_photos[_index]),
              fit: BoxFit.cover,
              alignment: Alignment.center,
            ),
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0x26000000), Color(0x66000000)],
              ),
            ),
          ),
          AnimatedOpacity(
            opacity: _showLogo ? 1 : 0,
            duration: const Duration(milliseconds: 420),
            child: Container(
              color: const Color(0xE605080D),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 38),
              child: const BrandLogo(height: 118),
            ),
          ),
        ],
      ),
    );
  }
}

class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.height = 86});
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      'assets/metallo_logo_outline.png',
      height: height,
      fit: BoxFit.contain,
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.data?.event == AuthChangeEvent.passwordRecovery) {
          return const ResetPasswordPage();
        }
        if (auth.currentSession == null) return const LoginPage();
        return const ProfileGate();
      },
    );
  }
}

class ProfileGate extends StatefulWidget {
  const ProfileGate({super.key});

  @override
  State<ProfileGate> createState() => _ProfileGateState();
}

class _ProfileGateState extends State<ProfileGate> {
  late final MetalloRepository repo =
      MetalloRepository(Supabase.instance.client);
  late Future<Map<String, dynamic>?> profile = repo.currentProfile();

  @override
  void dispose() {
    repo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: profile,
      builder: (context, snap) {
        if (snap.hasError) {
          return ErrorPage(
            message: friendlyError(snap.error),
            onRetry: () => setState(() => profile = repo.currentProfile()),
          );
        }
        if (!snap.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final p = snap.data!;
        if (p['active'] != true) {
          return PendingAccessPage(
            onRetry: () => setState(() => profile = repo.currentProfile()),
          );
        }
        return MainShell(profile: p);
      },
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();
  bool createMode = false;
  bool loading = false;
  String? error;
  String? message;

  Future<void> submit() async {
    if (loading) return;
    setState(() {
      loading = true;
      error = null;
      message = null;
    });
    try {
      if (createMode) {
        if (name.text.trim().isEmpty) throw Exception('Informe seu nome.');
        if (password.text.length < 4) {
          throw Exception('A senha precisa ter pelo menos 4 caracteres.');
        }
        await Supabase.instance.client.auth.signUp(
          email: email.text.trim(),
          password: password.text,
          data: {'full_name': name.text.trim()},
        );
        await Supabase.instance.client.auth.signOut();
        if (mounted) {
          setState(() {
            createMode = false;
            message =
                'Conta criada. Aguarde o administrador liberar seu acesso e definir equipe/cargo.';
          });
        }
      } else {
        await Supabase.instance.client.auth.signInWithPassword(
          email: email.text.trim(),
          password: password.text,
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> forgotPassword() async {
    final address = email.text.trim();
    if (address.isEmpty || !address.contains('@')) {
      setState(() => error = 'Informe seu e-mail para recuperar a senha.');
      return;
    }
    setState(() { loading = true; error = null; message = null; });
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(
        address,
        redirectTo: 'com.gunswiz.metallo://auth-callback/',
      );
      if (mounted) {
        setState(() => message = 'Enviamos um link de recuperação para $address.');
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: Center(
          child: SingleChildScrollView(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const BrandLogo(height: 105),
                  const SizedBox(height: 10),
                  Text(
                    createMode ? 'Criar nova conta' : 'Gestão de materiais e equipamentos',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 18,
                      color: Colors.white70,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 28),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(value: false, label: Text('Entrar')),
                      ButtonSegment(value: true, label: Text('Criar conta')),
                    ],
                    selected: {createMode},
                    onSelectionChanged: loading
                        ? null
                        : (s) => setState(() {
                              createMode = s.first;
                              error = null;
                              message = null;
                            }),
                  ),
                  const SizedBox(height: 18),
                  if (createMode) ...[
                    TextField(
                      controller: name,
                      decoration: const InputDecoration(
                        labelText: 'Nome',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'E-mail',
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: password,
                    obscureText: true,
                    onSubmitted: (_) => submit(),
                    decoration: InputDecoration(
                      labelText: createMode ? 'Senha (4+)' : 'Senha',
                      prefixIcon: const Icon(Icons.lock_outline),
                    ),
                  ),
                  if (!createMode)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: loading ? null : forgotPassword,
                        child: const Text('Esqueci minha senha'),
                      ),
                    ),
                  if (message != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      message!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF67D39A)),
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 14),
                    Text(
                      error!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: loading ? null : submit,
                    child: loading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(createMode ? 'Criar conta' : 'Entrar'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key});

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final password = TextEditingController();
  final confirmPassword = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> save() async {
    if (password.text.length < 4) {
      setState(() => error = 'A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (password.text != confirmPassword.text) {
      setState(() => error = 'As senhas não são iguais.');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: password.text),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Senha alterada com sucesso.')),
        );
        await Supabase.instance.client.auth.signOut();
      }
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      minimum: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const BrandLogo(height: 96),
              const SizedBox(height: 24),
              const Text('Definir nova senha', textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
              const SizedBox(height: 18),
              TextField(controller: password, obscureText: true,
                decoration: const InputDecoration(labelText: 'Nova senha (4+)')),
              const SizedBox(height: 12),
              TextField(controller: confirmPassword, obscureText: true,
                decoration: const InputDecoration(labelText: 'Confirmar nova senha')),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 18),
              FilledButton(onPressed: busy ? null : save,
                child: busy ? const CircularProgressIndicator(strokeWidth: 2) : const Text('Salvar nova senha')),
            ],
          ),
        ),
      ),
    ),
  );
}

class PendingAccessPage extends StatelessWidget {
  const PendingAccessPage({super.key, required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        minimum: const EdgeInsets.all(28),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandLogo(height: 92),
              const SizedBox(height: 24),
              const Icon(Icons.hourglass_top_rounded, size: 60, color: Color(0xFF1687FF)),
              const SizedBox(height: 16),
              const Text(
                'Acesso aguardando liberação',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'O administrador precisa definir sua equipe e seu cargo antes do primeiro acesso.',
                style: TextStyle(color: Colors.white60),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Verificar novamente'),
              ),
              TextButton(
                onPressed: () => Supabase.instance.client.auth.signOut(),
                child: const Text('Sair'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.profile});
  final Map<String, dynamic> profile;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 2;
  late final MetalloRepository repo =
      MetalloRepository(Supabase.instance.client);
  late final Stream<DashboardSnapshot> dashboard = repo.watchDashboard();

  String get role => widget.profile['role']?.toString() ?? 'collaborator';
  String? get userTeamId => widget.profile['team_id']?.toString();
  bool get isAdmin => role == 'admin';
  bool get canOperate => role == 'admin' || role == 'engineer' || role == 'leader';

  String get _tutorialKey => 'metallo_tutorial_v1_${Supabase.instance.client.auth.currentUser?.id ?? 'local'}_$role';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showTutorialIfNeeded());
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

  @override
  void dispose() {
    repo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      MaterialsPage(
        repo: repo,
        stream: dashboard,
        role: role,
        userTeamId: userTeamId,
      ),
      EquipmentPage(
        repo: repo,
        stream: dashboard,
        role: role,
        userTeamId: userTeamId,
      ),
      DashboardPage(repo: repo, stream: dashboard, role: role, userTeamId: userTeamId),
      ConsumptionPage(repo: repo, stream: dashboard),
      HistoryPage(repo: repo, stream: dashboard, isAdmin: isAdmin),
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
                  builder: (_) => AdministrationPage(repo: repo),
                ),
              ),
              icon: const Icon(Icons.admin_panel_settings_outlined),
            ),
          IconButton(
            tooltip: 'Minha conta',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => AccountSettingsPage(onReplayTutorial: _replayTutorial)),
            ),
            icon: const Icon(Icons.account_circle_outlined),
          ),
          IconButton(
            tooltip: 'Atualizar',
            onPressed: repo.refreshDashboard,
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
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Início'),
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


class _TutorialStep {
  const _TutorialStep({required this.page, required this.icon, required this.title, required this.body});
  final int page;
  final IconData icon;
  final String title;
  final String body;
}

List<_TutorialStep> _tutorialStepsForRole(String role) {
  final steps = <_TutorialStep>[
    const _TutorialStep(
      page: 2,
      icon: Icons.home_outlined,
      title: 'Início e equipes',
      body: 'A tela inicial resume cada equipe e a COSEM. Toque em um card para consultar materiais, equipamentos e integrantes sem precisar percorrer uma lista enorme.',
    ),
    const _TutorialStep(
      page: 0,
      icon: Icons.search_rounded,
      title: 'Encontre materiais rapidamente',
      body: 'Na aba Materiais, pesquise pelo nome ou código. Ao escolher um material já cadastrado, use a pesquisa do seletor em vez de procurar manualmente em uma lista longa.',
    ),
    const _TutorialStep(
      page: 1,
      icon: Icons.qr_code_2_rounded,
      title: 'Equipamentos e patrimônio',
      body: 'Consulte equipamentos por nome, código ou patrimônio. O patrimônio identifica a peça física e continua o mesmo quando ela muda de equipe.',
    ),
    const _TutorialStep(
      page: 3,
      icon: Icons.bar_chart_rounded,
      title: 'Consumo e tendências',
      body: 'Use Consumo para acompanhar materiais utilizados por equipe e período. Os gráficos ajudam a perceber aumento, redução e os itens mais consumidos.',
    ),
    const _TutorialStep(
      page: 4,
      icon: Icons.history_rounded,
      title: 'Histórico e filtros',
      body: 'O Histórico registra as operações. Pesquise por nome ou código e use o botão Filtrar histórico para separar entradas, consumos, reposições e transferências.',
    ),
  ];

  if (role == 'leader') {
    steps.addAll(const [
      _TutorialStep(page: 0, icon: Icons.add_box_outlined, title: 'Rotina do Encarregado', body: 'Você pode registrar as operações permitidas para a sua própria equipe. Antes de confirmar, confira material, quantidade e equipe para evitar correções posteriores.'),
      _TutorialStep(page: 3, icon: Icons.construction_rounded, title: 'Registrar consumo com cuidado', body: 'Consumo reduz o estoque da sua equipe. Confirme o material e a quantidade antes de concluir a operação.'),
      _TutorialStep(page: 1, icon: Icons.build_rounded, title: 'Manutenção de equipamento', body: 'Na aba Equipamentos, toque no patrimônio e escolha Enviar para manutenção. Durante a manutenção ele fica indisponível. Quando voltar, use Retornar da manutenção e confirme a equipe de destino.'),
    ]);
  } else if (role == 'engineer') {
    steps.addAll(const [
      _TutorialStep(page: 2, icon: Icons.groups_2_outlined, title: 'Visão do Engenheiro', body: 'Você pode consultar e operar em todas as equipes e na COSEM. Sempre confira a origem e o destino antes de registrar uma movimentação.'),
      _TutorialStep(page: 0, icon: Icons.warehouse_outlined, title: 'Reposição pela COSEM', body: 'Na reposição, a origem deve ser a COSEM e o destino uma equipe de campo. Use a busca por código ou nome para selecionar o material correto.'),
      _TutorialStep(page: 1, icon: Icons.build_rounded, title: 'Ciclo de manutenção', body: 'Toque em um equipamento para enviá-lo à manutenção. O patrimônio permanece rastreado e o status muda para Em manutenção. No retorno, escolha a equipe/local e registre a conclusão do serviço.'),
    ]);
  } else if (role == 'admin') {
    steps.addAll(const [
      _TutorialStep(page: 2, icon: Icons.admin_panel_settings_outlined, title: 'Administração', body: 'O ícone de Administração no topo dá acesso a usuários e equipes. Use essas funções para atribuir cargo e equipe e manter a estrutura organizada.'),
      _TutorialStep(page: 4, icon: Icons.edit_note_rounded, title: 'Correções de histórico', body: 'Como Admin, você pode corrigir registros do histórico. Faça isso somente quando necessário, pois a correção precisa manter o estoque consistente.'),
      _TutorialStep(page: 0, icon: Icons.inventory_rounded, title: 'Catálogo e códigos', body: 'Mantenha um único código por material. Para equipamentos, use o código do tipo e um patrimônio único para cada unidade física.'),
      _TutorialStep(page: 1, icon: Icons.build_rounded, title: 'Manutenção e retorno', body: 'Em Equipamentos, use Enviar para manutenção para retirar temporariamente o patrimônio de operação sem perder seu rastreio. Depois use Retornar da manutenção, escolha a equipe/local e confira o registro no Histórico.'),
    ]);
  }
  return steps;
}

Future<void> showMetalloTutorial(
  BuildContext context, {
  required String role,
  required ValueChanged<int> onNavigate,
}) async {
  final steps = _tutorialStepsForRole(role);
  var current = 0;
  onNavigate(steps.first.page);
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black.withValues(alpha: .72),
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) {
        final step = steps[current];
        return Dialog(
          backgroundColor: const Color(0xFF111720),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFF245B8E)),
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 520,
              maxHeight: MediaQuery.sizeOf(context).height * .72,
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0E3157),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(step.icon, color: const Color(0xFF52A9FF), size: 29),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Guia ${current + 1} de ${steps.length}',
                              style: const TextStyle(
                                color: Color(0xFF7CBFFF),
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              step.title,
                              style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Flexible(
                    child: SingleChildScrollView(
                      child: Text(
                        step.body,
                        style: const TextStyle(color: Colors.white70, height: 1.45, fontSize: 15),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  LinearProgressIndicator(
                    value: (current + 1) / steps.length,
                    minHeight: 5,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      TextButton(
                        style: TextButton.styleFrom(
                          minimumSize: const Size(64, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                        ),
                        onPressed: () => Navigator.pop(dialogContext),
                        child: const Text('Pular'),
                      ),
                      const Spacer(),
                      if (current > 0) ...[
                        TextButton(
                          style: TextButton.styleFrom(
                            minimumSize: const Size(70, 44),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                          ),
                          onPressed: () {
                            setLocal(() => current--);
                            onNavigate(steps[current].page);
                          },
                          child: const Text('Voltar'),
                        ),
                        const SizedBox(width: 6),
                      ],
                      FilledButton(
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(96, 44),
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: () {
                          if (current == steps.length - 1) {
                            Navigator.pop(dialogContext);
                            return;
                          }
                          setLocal(() => current++);
                          onNavigate(steps[current].page);
                        },
                        child: Text(current == steps.length - 1 ? 'Concluir' : 'Avançar'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    ),
  );
}

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({super.key, required this.onReplayTutorial});
  final Future<void> Function() onReplayTutorial;

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
    setState(() { busy = true; error = null; message = null; });
    try {
      await Supabase.instance.client.auth.updateUser(UserAttributes(email: value));
      if (mounted) setState(() => message = 'Solicitação enviada. Confirme a alteração pelos e-mails de segurança enviados pelo Supabase.');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> changePassword() async {
    if (password.text.length < 4) {
      setState(() => error = 'A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (password.text != password2.text) {
      setState(() => error = 'As senhas não são iguais.');
      return;
    }
    setState(() { busy = true; error = null; message = null; });
    try {
      await Supabase.instance.client.auth.updateUser(UserAttributes(password: password.text));
      password.clear(); password2.clear();
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
        const Text('Alterar e-mail', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        TextField(controller: email, keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Novo e-mail', prefixIcon: Icon(Icons.email_outlined))),
        const SizedBox(height: 10),
        FilledButton.icon(onPressed: busy ? null : changeEmail,
          icon: const Icon(Icons.mark_email_read_outlined), label: const Text('Solicitar alteração de e-mail')),
        const SizedBox(height: 26),
        const Text('Alterar senha', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        TextField(controller: password, obscureText: true,
          decoration: const InputDecoration(labelText: 'Nova senha (4+)')),
        const SizedBox(height: 10),
        TextField(controller: password2, obscureText: true,
          decoration: const InputDecoration(labelText: 'Confirmar nova senha')),
        const SizedBox(height: 10),
        FilledButton.icon(onPressed: busy ? null : changePassword,
          icon: const Icon(Icons.lock_reset), label: const Text('Alterar senha')),
        const SizedBox(height: 26),
        const Text('Ajuda', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: busy ? null : () async {
            Navigator.of(context).pop();
            await widget.onReplayTutorial();
          },
          icon: const Icon(Icons.school_outlined),
          label: const Text('Ver tutorial do aplicativo novamente'),
        ),
        if (message != null) ...[
          const SizedBox(height: 14), Text(message!, style: const TextStyle(color: Color(0xFF67D39A))),
        ],
        if (error != null) ...[
          const SizedBox(height: 14), Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
        ],
      ],
    ),
  );
}

class RoleBadge extends StatelessWidget {
  const RoleBadge({super.key, required this.role});
  final String role;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xFF0E3965),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF2C8BE8)),
      ),
      child: Text(
        roleLabel(role),
        style: const TextStyle(
          color: Color(0xFF8CC8FF),
          fontWeight: FontWeight.w800,
          fontSize: 11,
        ),
      ),
    );
  }
}

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.repo,
    required this.stream,
    required this.role,
    required this.userTeamId,
  });

  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;
  final String role;
  final String? userTeamId;

  bool get canOperate => role == 'admin' || role == 'engineer' || role == 'leader';

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: stream,
      builder: (context, snap) {
        if (snap.hasError) return ErrorState(error: snap.error);
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final data = snap.data!;

        return RefreshIndicator(
          onRefresh: repo.refreshDashboard,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF111A25), Color(0xFF07101B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(color: const Color(0xFF164C80)),
                ),
                child: Column(
                  children: [
                    const BrandLogo(height: 68),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.groups_2_outlined,
                            value: '${data.teams.where((t) => !t.isCentral).length}',
                            label: 'Equipes',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.inventory_2_outlined,
                            value: '${data.materials.map((m) => m.itemId).toSet().length}',
                            label: 'Materiais',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.handyman_outlined,
                            value: '${data.equipment.length}',
                            label: 'Equipamentos',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Equipes e inventário',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              const Text(
                'Cada item aparece na equipe onde está fisicamente.',
                style: TextStyle(color: Colors.white60),
              ),
              const SizedBox(height: 14),
              for (final team in data.teams)
                TeamOverviewCard(
                  repo: repo,
                  team: team,
                  materials: data.materials.where((m) => m.teamId == team.id).toList(),
                  equipment: data.equipment.where((e) => e.teamId == team.id).toList(),
                ),
            ],
          ),
        );
      },
    );
  }
}

class SummaryTile extends StatelessWidget {
  const SummaryTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
  });
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF141C27),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: const Color(0xFF243449)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF3B9EFF), size: 19),
          const SizedBox(height: 7),
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11, color: Colors.white60),
          ),
        ],
      ),
    );
  }
}

class TeamOverviewCard extends StatelessWidget {
  const TeamOverviewCard({super.key, required this.repo, required this.team, required this.materials, required this.equipment});
  final MetalloRepository repo;
  final Team team;
  final List<MaterialStock> materials;
  final List<EquipmentAsset> equipment;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => TeamDetailPage(repo: repo, team: team, materials: materials, equipment: equipment))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            CircleAvatar(backgroundColor: const Color(0xFF0E3157), child: Icon(team.isCentral ? Icons.warehouse_outlined : Icons.groups_2_outlined, color: const Color(0xFF52A9FF))),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(team.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
              const SizedBox(height: 7),
              Wrap(spacing: 12, runSpacing: 6, children: [
                _CountChip(icon: Icons.inventory_2_outlined, text: '${materials.length} materiais'),
                _CountChip(icon: Icons.handyman_outlined, text: '${equipment.length} equipamentos'),
              ]),
            ])),
            const Icon(Icons.chevron_right_rounded, color: Colors.white38),
          ]),
        ),
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.icon, required this.text});
  final IconData icon; final String text;
  @override Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 15, color: const Color(0xFF52A9FF)), const SizedBox(width: 4), Text(text, style: const TextStyle(color: Colors.white60, fontSize: 12))]);
}

class TeamDetailPage extends StatefulWidget {
  const TeamDetailPage({super.key, required this.repo, required this.team, required this.materials, required this.equipment});
  final MetalloRepository repo; final Team team; final List<MaterialStock> materials; final List<EquipmentAsset> equipment;
  @override State<TeamDetailPage> createState() => _TeamDetailPageState();
}
class _TeamDetailPageState extends State<TeamDetailPage> {
  int tab=0; String query=''; late Future<List<Map<String,dynamic>>> people;
  @override void initState(){super.initState(); people=widget.repo.fetchProfiles();}
  @override Widget build(BuildContext context){
    final q=query.trim().toLowerCase();
    final mats=widget.materials.where((m)=>q.isEmpty||'${m.code} ${m.name}'.toLowerCase().contains(q)).toList();
    final eqs=widget.equipment.where((e)=>q.isEmpty||'${e.code} ${e.name} ${e.assetCode}'.toLowerCase().contains(q)).toList();
    return Scaffold(appBar: AppBar(title: Text(widget.team.name)), body: Column(children:[
      Padding(padding: const EdgeInsets.all(16), child: SegmentedButton<int>(segments: const [ButtonSegment(value:0,icon:Icon(Icons.inventory_2_outlined),label:Text('Materiais')),ButtonSegment(value:1,icon:Icon(Icons.handyman_outlined),label:Text('Equipamentos')),ButtonSegment(value:2,icon:Icon(Icons.people_outline),label:Text('Integrantes'))], selected:{tab}, onSelectionChanged:(v)=>setState(()=>tab=v.first))),
      Padding(padding: const EdgeInsets.fromLTRB(16,0,16,10), child: TextField(onChanged:(v)=>setState(()=>query=v), decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: tab==0?'Pesquisar material por nome ou código':tab==1?'Pesquisar equipamento, código ou patrimônio':'Pesquisar integrante'))),
      Expanded(child: tab==0 ? ListView.builder(padding:const EdgeInsets.symmetric(horizontal:16),itemCount:mats.length,itemBuilder:(_,i){final m=mats[i];return Card(child:ListTile(title:Text(m.name),subtitle:Text(m.code),trailing:Text('${m.quantity} ${m.unit}',style:const TextStyle(color:Color(0xFF52A9FF),fontWeight:FontWeight.w900))));}) : tab==1 ? ListView.builder(padding:const EdgeInsets.symmetric(horizontal:16),itemCount:eqs.length,itemBuilder:(_,i){final e=eqs[i];return Card(child:ListTile(title:Text(e.name),subtitle:Text('${e.code} • Patrimônio ${e.assetCode}'),trailing:StatusBadge(status:e.status)));}) : FutureBuilder<List<Map<String,dynamic>>>(future:people,builder:(context,snap){if(!snap.hasData)return const Center(child:CircularProgressIndicator());final rows=snap.data!.where((u)=>u['team_id']?.toString()==widget.team.id && (q.isEmpty||(u['full_name']?.toString().toLowerCase().contains(q)??false))).toList();if(rows.isEmpty)return const EmptyState(icon:Icons.people_outline,title:'Nenhum integrante',subtitle:'Nenhum usuário está atribuído a este local.');return ListView.builder(padding:const EdgeInsets.symmetric(horizontal:16),itemCount:rows.length,itemBuilder:(_,i){final u=rows[i];return Card(child:ListTile(leading:const CircleAvatar(child:Icon(Icons.person_outline)),title:Text(u['full_name']?.toString()??'Usuário'),subtitle:Text(roleLabel(u['role']?.toString()??'collaborator'))));});})),
    ]));
  }
}

class TeamInventoryCard extends StatelessWidget {
  const TeamInventoryCard({
    super.key,
    required this.team,
    required this.materials,
    required this.equipment,
    required this.canOperate,
    required this.onAddMaterial,
    required this.onAddEquipment,
  });

  final Team team;
  final List<MaterialStock> materials;
  final List<EquipmentAsset> equipment;
  final bool canOperate;
  final VoidCallback onAddMaterial;
  final VoidCallback onAddEquipment;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Color(0xFF0E3157),
                  child: Icon(Icons.groups_2, color: Color(0xFF52A9FF)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    team.name,
                    style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                  ),
                ),
                Text(
                  '${materials.length} mat. • ${equipment.length} eq.',
                  style: const TextStyle(color: Colors.white54),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Materiais', style: TextStyle(fontWeight: FontWeight.w800)),
            if (materials.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Nenhum material.', style: TextStyle(color: Colors.white54)),
              )
            else
              for (final m in materials.take(5))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(m.name),
                  subtitle: Text(m.code),
                  trailing: Text(
                    '${m.quantity} ${m.unit}',
                    style: const TextStyle(
                      color: Color(0xFF52A9FF),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
            const Divider(),
            const Text('Equipamentos', style: TextStyle(fontWeight: FontWeight.w800)),
            if (equipment.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Nenhum equipamento.', style: TextStyle(color: Colors.white54)),
              )
            else
              for (final e in equipment.take(5))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(e.name),
                  subtitle: Text('Patrimônio ${e.assetCode}'),
                  trailing: StatusBadge(status: e.status),
                ),
            if (canOperate) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onAddMaterial,
                      icon: const Icon(Icons.add_box_outlined),
                      label: const Text('Material'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: onAddEquipment,
                      icon: const Icon(Icons.add),
                      label: const Text('Equipamento'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class MaterialsPage extends StatefulWidget {
  const MaterialsPage({
    super.key,
    required this.repo,
    required this.stream,
    required this.role,
    required this.userTeamId,
  });
  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;
  final String role;
  final String? userTeamId;

  @override
  State<MaterialsPage> createState() => _MaterialsPageState();
}

class _MaterialsPageState extends State<MaterialsPage> {
  final search = TextEditingController();

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.stream,
      builder: (context, snap) {
        if (snap.hasError) return ErrorState(error: snap.error);
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final data = snap.data!;
        final canOperate = widget.role == 'admin' || widget.role == 'engineer' || widget.role == 'leader';
        final allowedTeams = widget.role == 'leader'
            ? data.teams.where((t) => t.id == widget.userTeamId).toList()
            : data.teams;
        final q = search.text.trim().toLowerCase();
        final materials = data.materials.where((m) {
          if (q.isEmpty) return true;
          final team = findTeam(data.teams, m.teamId)?.name ?? '';
          return m.name.toLowerCase().contains(q) ||
              m.code.toLowerCase().contains(q) ||
              team.toLowerCase().contains(q);
        }).toList();

        return Scaffold(
          backgroundColor: const Color(0xFF05080D),
          endDrawer: MaterialCatalogDrawer(repo: widget.repo, isAdmin: widget.role == 'admin'),
          floatingActionButton: canOperate && allowedTeams.isNotEmpty
              ? FloatingActionButton.extended(
                  onPressed: () => showMaterialDialog(
                    context, widget.repo, allowedTeams, widget.role == 'leader' ? widget.userTeamId : null,
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text('Entrada'),
                )
              : null,
          body: Builder(
            builder: (innerContext) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              children: [
                TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Pesquisar material por nome ou código',
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
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.menu_book_outlined, color: Color(0xFF52A9FF)),
                    title: const Text('Catálogo de materiais', style: TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text('Consultar códigos em ordem e gerenciar materiais cadastrados'),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () => Scaffold.of(innerContext).openEndDrawer(),
                  ),
                ),
                const SizedBox(height: 8),
                if (data.materials.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 50),
                    child: EmptyState(
                      icon: Icons.inventory_2_outlined,
                      title: 'Nenhum material em estoque',
                      subtitle: 'Use o catálogo para consultar os materiais cadastrados.',
                    ),
                  )
                else if (materials.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyState(
                      icon: Icons.search_off,
                      title: 'Nenhum material encontrado',
                      subtitle: 'Tente pesquisar por outro nome ou código.',
                    ),
                  )
                else
                  for (final m in materials)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.inventory_2_outlined, color: Color(0xFF52A9FF)),
                        title: Text(m.name),
                        subtitle: Text('${findTeam(data.teams, m.teamId)?.name ?? 'Local'} • ${m.code}'),
                        trailing: Text('${m.quantity} ${m.unit}',
                          style: const TextStyle(color: Color(0xFF52A9FF), fontWeight: FontWeight.w900)),
                        onTap: canOperate && (widget.role == 'admin' || widget.role == 'engineer' || m.teamId == widget.userTeamId)
                            ? () => showMaterialActionsDialog(context, widget.repo, data.teams, m, widget.role, widget.userTeamId)
                            : null,
                      ),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class MaterialCatalogDrawer extends StatefulWidget {
  const MaterialCatalogDrawer({super.key, required this.repo, required this.isAdmin});
  final MetalloRepository repo;
  final bool isAdmin;

  @override
  State<MaterialCatalogDrawer> createState() => _MaterialCatalogDrawerState();
}

class _MaterialCatalogDrawerState extends State<MaterialCatalogDrawer> {
  late Future<List<Map<String, dynamic>>> catalog = widget.repo.fetchMaterialCatalog();
  void reload() => setState(() => catalog = widget.repo.fetchMaterialCatalog());

  @override
  Widget build(BuildContext context) => Drawer(
    width: MediaQuery.sizeOf(context).width * .90,
    backgroundColor: const Color(0xFF0A0F16),
    child: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 8, 10),
            child: Row(children: [
              const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Catálogo de materiais', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
                Text('Ordenado pelo código global', style: TextStyle(color: Colors.white60)),
              ])),
              IconButton(onPressed: reload, icon: const Icon(Icons.refresh)),
              IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
            ]),
          ),
          const Divider(height: 1),
          Expanded(
            child: FutureBuilder<List<Map<String, dynamic>>>(
              future: catalog,
              builder: (context, snap) {
                if (snap.hasError) return ErrorState(error: snap.error);
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                if (snap.data!.isEmpty) return const Center(child: Text('Nenhum material cadastrado.'));
                return ListView.separated(
                  padding: const EdgeInsets.all(10),
                  itemCount: snap.data!.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final m = snap.data![i];
                    return ListTile(
                      leading: Container(
                        constraints: const BoxConstraints(minWidth: 58),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                        decoration: BoxDecoration(color: const Color(0xFF0E3965), borderRadius: BorderRadius.circular(9)),
                        child: Text(m['code']?.toString() ?? '-', textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF8CC8FF), fontWeight: FontWeight.w900)),
                      ),
                      title: Text(m['name']?.toString() ?? ''),
                      subtitle: Text('${m['unit'] ?? 'un'}${(m['category']?.toString().isNotEmpty ?? false) ? ' • ${m['category']}' : ''}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Total: ${(m['total_quantity'] as num?)?.toInt() ?? 0} ${m['unit'] ?? 'un'}',
                            style: const TextStyle(color: Color(0xFF89CFF0), fontWeight: FontWeight.w900),
                          ),
                          if (widget.isAdmin)
                            PopupMenuButton<String>(
                              onSelected: (value) async {
                                if (value == 'edit') {
                                  final changed = await showEditMaterialCatalogDialog(context, widget.repo, m);
                                  if (changed == true) reload();
                                } else if (value == 'delete') {
                                  final ok = await confirm(context, 'Excluir material?',
                                    'O material será retirado do catálogo. Por segurança, a exclusão só é permitida quando não houver saldo em nenhuma localização. O histórico será preservado.');
                                  if (ok == true) {
                                    try { await widget.repo.deactivateMaterialItem(m['id'].toString()); reload(); }
                                    catch (e) { if (context.mounted) showError(context, e); }
                                  }
                                }
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'edit', child: Text('Editar')),
                                PopupMenuItem(value: 'delete', child: Text('Excluir')),
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    ),
  );
}

Future<bool?> showEditMaterialCatalogDialog(BuildContext context, MetalloRepository repo, Map<String, dynamic> material) async {
  final code = TextEditingController(text: material['code']?.toString() ?? '');
  final name = TextEditingController(text: material['name']?.toString() ?? '');
  final unit = TextEditingController(text: material['unit']?.toString() ?? 'un');
  final category = TextEditingController(text: material['category']?.toString() ?? '');
  final description = TextEditingController(text: material['description']?.toString() ?? '');
  bool busy = false; String? error;
  return showDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(
    builder: (context, setLocal) => AlertDialog(
      title: const Text('Editar material'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: code, decoration: const InputDecoration(labelText: 'Código global')),
        const SizedBox(height: 10), TextField(controller: name, decoration: const InputDecoration(labelText: 'Nome')),
        const SizedBox(height: 10), TextField(controller: unit, decoration: const InputDecoration(labelText: 'Unidade')),
        const SizedBox(height: 10), TextField(controller: category, decoration: const InputDecoration(labelText: 'Categoria (opcional)')),
        const SizedBox(height: 10), TextField(controller: description, decoration: const InputDecoration(labelText: 'Descrição (opcional)')),
        if (error != null) ...[const SizedBox(height: 10), Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))],
      ])),
      actions: [
        TextButton(onPressed: busy ? null : () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
        FilledButton(onPressed: busy ? null : () async {
          final v = requiredText(code.text, 'Código') ?? requiredText(name.text, 'Nome');
          if (v != null) { setLocal(() => error = v); return; }
          setLocal(() { busy = true; error = null; });
          try {
            await repo.updateMaterialItem(itemId: material['id'].toString(), code: code.text, name: name.text,
              unit: unit.text, category: category.text, description: description.text);
            if (dialogContext.mounted) Navigator.pop(dialogContext, true);
          } catch (e) { setLocal(() => error = friendlyError(e)); }
          finally { if (dialogContext.mounted) setLocal(() => busy = false); }
        }, child: busy ? const CircularProgressIndicator(strokeWidth: 2) : const Text('Salvar')),
      ],
    ),
  ));
}

class EquipmentPage extends StatefulWidget {
  const EquipmentPage({
    super.key,
    required this.repo,
    required this.stream,
    required this.role,
    required this.userTeamId,
  });
  final MetalloRepository repo;
  final Stream<DashboardSnapshot> stream;
  final String role;
  final String? userTeamId;

  @override
  State<EquipmentPage> createState() => _EquipmentPageState();
}

class _EquipmentPageState extends State<EquipmentPage> {
  final search = TextEditingController();
  String ownershipFilter = 'all';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: widget.stream,
      builder: (context, snap) {
        if (snap.hasError) return ErrorState(error: snap.error);
        if (!snap.hasData) return const Center(child: CircularProgressIndicator());
        final data = snap.data!;
        final canOperate = widget.role == 'admin' || widget.role == 'engineer' || widget.role == 'leader';
        final allowedTeams = widget.role == 'leader'
            ? data.teams.where((t) => t.id == widget.userTeamId).toList()
            : data.teams;
        final q = search.text.trim().toLowerCase();
        final equipment = data.equipment.where((e) {
          if (ownershipFilter != 'all' && e.ownershipType != ownershipFilter) return false;
          if (q.isEmpty) return true;
          final team = findTeam(data.teams, e.teamId)?.name ?? '';
          return e.name.toLowerCase().contains(q) ||
              e.assetCode.toLowerCase().contains(q) ||
              (e.rentalCompany?.toLowerCase().contains(q) ?? false) ||
              team.toLowerCase().contains(q);
        }).toList();

        return Scaffold(
          backgroundColor: const Color(0xFF05080D),
          endDrawer: EquipmentCatalogDrawer(repo: widget.repo, isAdmin: widget.role == 'admin', teams: data.teams),
          floatingActionButton: canOperate && allowedTeams.isNotEmpty
              ? FloatingActionButton.extended(
                  onPressed: () => showEquipmentDialog(
                    context,
                    widget.repo,
                    allowedTeams,
                    widget.role == 'leader' ? widget.userTeamId : null,
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text('Novo equipamento'),
                )
              : null,
          body: Builder(
            builder: (innerContext) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
              children: [
                TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Pesquisar equipamento por nome ou código',
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
                SegmentedButton<String>(segments: const [
                  ButtonSegment(value: 'all', label: Text('Todos'), icon: Icon(Icons.apps_rounded)),
                  ButtonSegment(value: 'owned', label: Text('Próprios'), icon: Icon(Icons.business_rounded)),
                  ButtonSegment(value: 'rented', label: Text('Alugados'), icon: Icon(Icons.key_rounded)),
                ], selected: {ownershipFilter}, onSelectionChanged: (value) => setState(() => ownershipFilter = value.first)),
                const SizedBox(height: 10),
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.menu_book_outlined, color: Colors.blueGrey),
                    title: const Text('Catálogo de equipamentos', style: TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: const Text('Consultar próprios e alugados por patrimônio'),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () => Scaffold.of(innerContext).openEndDrawer(),
                  ),
                ),
                const SizedBox(height: 8),
                if (data.equipment.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 50),
                    child: EmptyState(
                      icon: Icons.handyman_outlined,
                      title: 'Nenhum equipamento',
                      subtitle: 'Os equipamentos cadastrados aparecerão aqui.',
                    ),
                  )
                else if (equipment.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 40),
                    child: EmptyState(
                      icon: Icons.search_off,
                      title: 'Nenhum equipamento encontrado',
                      subtitle: 'Tente pesquisar por outro nome ou código.',
                    ),
                  )
                else
                  for (final e in equipment)
                    Card(
                      child: ListTile(
                        leading: const Icon(Icons.handyman_outlined),
                        title: Text(e.name),
                        subtitle: Text([findTeam(data.teams, e.teamId)?.name ?? 'Equipe', 'código ${e.assetCode}', e.ownershipType == 'rented' ? 'Alugado${e.rentalCompany?.isNotEmpty == true ? ' • ${e.rentalCompany}' : ''}' : 'Próprio'].join(' • ')),
                        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [EquipmentOwnershipBadge(type: e.ownershipType), const SizedBox(height: 4), StatusBadge(status: e.status)]),
                        onTap: canOperate &&
                                (widget.role == 'admin' || widget.role == 'engineer' || e.teamId == widget.userTeamId)
                            ? () => showEquipmentActionsSheet(
                                  context,
                                  widget.repo,
                                  data.teams,
                                  e,
                                  role: widget.role,
                                  userTeamId: widget.userTeamId,
                                )
                            : null,
                      ),
                    ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class EquipmentCatalogDrawer extends StatefulWidget {
  const EquipmentCatalogDrawer({
    super.key,
    required this.repo,
    required this.isAdmin,
    required this.teams,
  });
  final MetalloRepository repo;
  final bool isAdmin;
  final List<Team> teams;

  @override
  State<EquipmentCatalogDrawer> createState() => _EquipmentCatalogDrawerState();
}

class _EquipmentCatalogDrawerState extends State<EquipmentCatalogDrawer> {
  late Future<List<Map<String, dynamic>>> catalog = widget.repo.fetchEquipmentCatalog();
  void reload() => setState(() => catalog = widget.repo.fetchEquipmentCatalog());

  @override
  Widget build(BuildContext context) => Drawer(
        width: MediaQuery.sizeOf(context).width * .90,
        backgroundColor: const Color(0xFF0A0F16),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 8, 10),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Catálogo de equipamentos', style: TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
                          Text('Ordenado pelo código individual', style: TextStyle(color: Colors.white60)),
                        ],
                      ),
                    ),
                    IconButton(onPressed: reload, icon: const Icon(Icons.refresh)),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: FutureBuilder<List<Map<String, dynamic>>>(
                  future: catalog,
                  builder: (context, snap) {
                    if (snap.hasError) return ErrorState(error: snap.error);
                    if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                    if (snap.data!.isEmpty) return const Center(child: Text('Nenhum equipamento cadastrado.'));
                    return ListView.separated(
                      padding: const EdgeInsets.all(10),
                      itemCount: snap.data!.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final e = snap.data![i];
                        final item = e['items'] as Map?;
                        final team = e['teams'] as Map?;
                        final ownership = parseEquipmentOwnership(e['notes'] as String?);
                        return ListTile(
                          leading: Container(
                            constraints: const BoxConstraints(minWidth: 62),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF26313D),
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: Text(
                              e['asset_code']?.toString() ?? '-',
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Color(0xFFCFD8E3), fontWeight: FontWeight.w900),
                            ),
                          ),
                          title: Row(children: [Expanded(child: Text(item?['name']?.toString() ?? 'Equipamento')), EquipmentOwnershipBadge(type: ownership.type)]),
                          subtitle: Text([
                            if ((item?['code']?.toString() ?? '').isNotEmpty) 'modelo ${item?['code']}',
                            if ((team?['name']?.toString() ?? '').isNotEmpty) team?['name'].toString(),
                            if (ownership.isRented && ownership.rentalCompany?.isNotEmpty == true) ownership.rentalCompany!,
                            if (ownership.isRented && ownership.rentalEndDate?.isNotEmpty == true) 'até ${ownership.rentalEndDate}',
                            statusLabel(e['status']?.toString() ?? 'available'),
                          ].join(' • ')),
                          trailing: widget.isAdmin
                              ? PopupMenuButton<String>(
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      final changed = await showEditEquipmentCatalogDialog(
                                        context,
                                        widget.repo,
                                        widget.teams,
                                        e,
                                      );
                                      if (changed == true) reload();
                                    } else if (value == 'delete') {
                                      final ok = await confirm(
                                        context,
                                        'Excluir equipamento?',
                                        'O equipamento será desativado e deixará de aparecer no estoque e no catálogo. O histórico será preservado.',
                                      );
                                      if (ok == true) {
                                        try {
                                          await widget.repo.deactivateEquipmentAsset(e['id'].toString());
                                          reload();
                                        } catch (err) {
                                          if (context.mounted) showError(context, err);
                                        }
                                      }
                                    }
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(value: 'edit', child: Text('Editar')),
                                    PopupMenuItem(value: 'delete', child: Text('Excluir')),
                                  ],
                                )
                              : null,
                        );
                      },
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      );
}

Future<bool?> showEditEquipmentCatalogDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> equipment,
) async {
  final assetCode = TextEditingController(text: equipment['asset_code']?.toString() ?? '');
  final serialNumber = TextEditingController(text: equipment['serial_number']?.toString() ?? '');
  final ownership = parseEquipmentOwnership(equipment['notes'] as String?);
  final notes = TextEditingController(text: ownership.notes ?? '');
  final rentalCompany = TextEditingController(text: ownership.rentalCompany ?? '');
  final rentalEndDate = TextEditingController(text: ownership.rentalEndDate ?? '');
  String ownershipType = ownership.type;
  String? teamId = equipment['team_id']?.toString();
  String status = equipment['status']?.toString() ?? 'available';
  const statuses = ['available', 'in_use', 'maintenance', 'damaged', 'lost', 'retired'];
  bool busy = false;
  String? error;
  final item = equipment['items'] as Map?;

  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: const Text('Editar equipamento'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (item != null)
                Text(
                  '${item['name'] ?? 'Equipamento'}${(item['code']?.toString() ?? '').isNotEmpty ? ' • modelo ${item['code']}' : ''}',
                  style: const TextStyle(color: Colors.white60, fontWeight: FontWeight.w700),
                ),
              const SizedBox(height: 12),
              TextField(controller: assetCode, decoration: const InputDecoration(labelText: 'Código/patrimônio')),
              const SizedBox(height: 10),
              TextField(controller: serialNumber, decoration: const InputDecoration(labelText: 'Número de série (opcional)')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(initialValue: ownershipType, decoration: const InputDecoration(labelText: 'Propriedade'), items: const [DropdownMenuItem(value: 'owned', child: Text('Próprio da empresa')), DropdownMenuItem(value: 'rented', child: Text('Equipamento alugado'))], onChanged: busy ? null : (v) => setLocal(() => ownershipType = v ?? 'owned')),
              if (ownershipType == 'rented') ...[const SizedBox(height: 10), TextField(controller: rentalCompany, decoration: const InputDecoration(labelText: 'Empresa locadora')), const SizedBox(height: 10), TextField(controller: rentalEndDate, decoration: const InputDecoration(labelText: 'Fim da locação', hintText: 'AAAA-MM-DD'))],
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: teams.any((t) => t.id == teamId) ? teamId : null,
                decoration: const InputDecoration(labelText: 'Equipe / localização'),
                items: teams.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
                onChanged: busy ? null : (v) => setLocal(() => teamId = v),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: statuses.contains(status) ? status : 'available',
                decoration: const InputDecoration(labelText: 'Status'),
                items: statuses.map((s) => DropdownMenuItem(value: s, child: Text(statusLabel(s)))).toList(),
                onChanged: busy ? null : (v) => setLocal(() => status = v ?? 'available'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: notes,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Observações (opcional)'),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: busy ? null : () => Navigator.pop(dialogContext, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: busy
                ? null
                : () async {
                    final validation = requiredText(assetCode.text, 'Código/patrimônio');
                    if (validation != null) {
                      setLocal(() => error = validation);
                      return;
                    }
                    if (ownershipType == 'rented' && rentalCompany.text.trim().isEmpty) { setLocal(() => error = 'Informe a empresa locadora.'); return; }
                    if (teamId == null) {
                      setLocal(() => error = 'Selecione a equipe/localização.');
                      return;
                    }
                    setLocal(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await repo.updateEquipmentAsset(
                        assetId: equipment['id'].toString(),
                        assetCode: assetCode.text,
                        serialNumber: serialNumber.text,
                        teamId: teamId!,
                        status: status,
                        notes: notes.text,
                        ownershipType: ownershipType,
                        rentalCompany: rentalCompany.text,
                        rentalEndDate: rentalEndDate.text,
                      );
                      if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                    } catch (e) {
                      setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            child: busy ? const CircularProgressIndicator(strokeWidth: 2) : const Text('Salvar'),
          ),
        ],
      ),
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
              subtitle: const Text('Engenheiro, encarregado ou colaborador com equipe definida'),
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
      setState(() => error = 'A senha temporária precisa ter 4 ou mais caracteres.');
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
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final teams = snap.data!.teams;
        teamId ??= teams.isEmpty ? null : teams.first.id;

        return Scaffold(
          appBar: AppBar(title: const Text('Novo funcionário')),
          body: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Nome')),
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
                decoration: const InputDecoration(labelText: 'Senha temporária (4+)'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Cargo'),
                items: const [
                  DropdownMenuItem(value: 'engineer', child: Text('Engenheiro')),
                  DropdownMenuItem(value: 'leader', child: Text('Encarregado')),
                  DropdownMenuItem(value: 'collaborator', child: Text('Colaborador')),
                ],
                onChanged: busy ? null : (v) => setState(() => role = v!),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe'),
                items: teams
                    .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setState(() => teamId = v),
              ),
              if (error != null) ...[
                const SizedBox(height: 12),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final teams = teamSnap.data!.teams;

        return Scaffold(
          appBar: AppBar(title: const Text('Usuários')),
          body: FutureBuilder<List<Map<String, dynamic>>>(
            future: users,
            builder: (context, snap) {
              if (snap.hasError) return ErrorState(error: snap.error);
              if (!snap.hasData) return const Center(child: CircularProgressIndicator());
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
                              await showUserEditDialog(context, widget.repo, teams, user);
                              reload();
                            } else if (action == 'delete') {
                              final yes = await confirm(
                                context,
                                'Excluir usuário?',
                                'O acesso será removido permanentemente. O histórico operacional já registrado será preservado.',
                              );
                              if (yes == true) {
                                try {
                                  await widget.repo.deleteEmployee(user['id'].toString());
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
                        onTap: () async {
                          await showUserEditDialog(context, widget.repo, teams, user);
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
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final teams = snap.data!.teams;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${teams.where((t) => !t.isCentral).length} equipes de campo • COSEM separada',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              for (final t in teams)
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.groups_2_outlined),
                    title: Text(t.name),
                    subtitle: t.description == null ? null : Text(t.description!),
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
          Positioned(bottom: 4, child: Icon(Icons.inventory_2_outlined, color: color, size: 27)),
          Positioned(top: 2, child: Icon(Icons.arrow_downward_rounded, color: color, size: 18)),
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

Future<void> showHistoryDetails(BuildContext context, Map<String, dynamic> row) async {
  final isMaterial = row['_kind'] == 'material';
  final item = isMaterial
      ? row['items'] as Map?
      : (row['assets'] as Map?)?['items'] as Map?;
  final asset = row['assets'] as Map?;
  final origin = (row['origin'] as Map?)?['name']?.toString();
  final destination = (row['destination'] as Map?)?['name']?.toString();
  final note = row['note']?.toString();
  final movement = movementLabel(row['movement_type']?.toString() ?? '');
  final name = item?['name']?.toString() ?? (isMaterial ? 'Material' : 'Equipamento');
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
                  Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
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
        padding: EdgeInsets.fromLTRB(20, 18, 20, 24 + MediaQuery.viewInsetsOf(sheetContext).bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                ),
                IconButton(onPressed: () => Navigator.pop(sheetContext), icon: const Icon(Icons.close)),
              ],
            ),
            Text(movement, style: const TextStyle(color: Color(0xFF8CC8FF), fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            const Divider(),
            line(Icons.calendar_month_outlined, 'Data e horário', formatHistoryDateTime(row['created_at'])),
            if ((code ?? '').isNotEmpty) line(Icons.tag, 'Código', code!),
            if (!isMaterial && (assetCode ?? '').isNotEmpty) line(Icons.qr_code_2, 'Patrimônio / código individual', assetCode!),
            if (isMaterial) line(Icons.numbers, 'Quantidade', '${row['quantity'] ?? 0}'),
            if (origin != null && origin.isNotEmpty) line(Icons.logout, 'Origem', origin),
            if (destination != null && destination.isNotEmpty) line(Icons.login, 'Destino', destination),
            if (!isMaterial && (previousStatus ?? '').isNotEmpty)
              line(Icons.swap_horiz, 'Status anterior', statusLabel(previousStatus!)),
            if (!isMaterial && (newStatus ?? '').isNotEmpty)
              line(Icons.check_circle_outline, 'Novo status', statusLabel(newStatus!)),
            if (note != null && note.trim().isNotEmpty) line(Icons.notes, 'Observação', note),
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
        if (!ds.hasData) return const Center(child: CircularProgressIndicator());
        final teams = ds.data!.teams.where((t) => !t.isCentral).toList();
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.repo.fetchMaterialConsumption(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final rows = snap.data!;
            final now = DateTime.now();
            final current = _filterConsumption(rows, teamId, _periodStart(now, period), _periodEnd(now, period));
            final previousStart = period == 'week'
                ? _periodStart(now, period).subtract(const Duration(days: 7))
                : DateTime(now.year, now.month - 1, 1);
            final previousEnd = _periodStart(now, period);
            final previous = _filterConsumption(rows, teamId, previousStart, previousEnd);
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
                      const Expanded(child: Text('Consumo', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w900))),
                      IconButton(
                        tooltip: 'Consumo semanal',
                        icon: const Icon(Icons.table_rows_rounded),
                        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ConsumptionMaterialsPage(rows: rows, teams: teams, initialTeamId: teamId))),
                      ),
                      IconButton(
                        tooltip: 'Gráficos',
                        icon: const Icon(Icons.filter_alt_outlined),
                        onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ConsumptionGraphsPage(rows: rows, teams: teams, initialTeamId: teamId))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: _teamDropdown(teams, teamId, (v) => setState(() => teamId = v))),
                    const SizedBox(width: 10),
                    Expanded(child: DropdownButtonFormField<String>(
                      initialValue: period,
                      decoration: const InputDecoration(labelText: 'Período', prefixIcon: Icon(Icons.calendar_month_outlined)),
                      items: const [
                        DropdownMenuItem(value: 'week', child: Text('Esta semana')),
                        DropdownMenuItem(value: 'month', child: Text('Este mês')),
                      ],
                      onChanged: (v) => setState(() => period = v ?? 'month'),
                    )),
                  ]),
                  const SizedBox(height: 14),
                  _MetricCard(
                    eyebrow: 'COMPARAÇÃO COM ${period == 'week' ? 'SEMANA' : 'MÊS'} ANTERIOR',
                    title: 'Total consumido',
                    value: _formatQty(currentTotal),
                    suffix: _mixedUnits(current),
                    change: change,
                    comparisonText: 'vs ${period == 'week' ? 'Semana' : 'Mês'} anterior',
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Resumo por categoria', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                        const SizedBox(height: 14),
                        if (categories.isEmpty)
                          const Padding(padding: EdgeInsets.symmetric(vertical: 18), child: Text('Nenhum consumo neste período.', style: TextStyle(color: Colors.white54)))
                        else
                          Row(children: [
                            SizedBox(width: 130, height: 130, child: ConsumptionDonutChart(data: categories)),
                            const SizedBox(width: 14),
                            Expanded(child: Column(children: [for (int i = 0; i < categories.length && i < 5; i++) _CategoryLegendRow(index: i, data: categories[i])])),
                          ]),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Top 5 materiais mais consumidos', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                        const SizedBox(height: 8),
                        if (ranking.isEmpty)
                          const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Text('Nenhum consumo registrado.', style: TextStyle(color: Colors.white54)))
                        else
                          for (int i = 0; i < ranking.length && i < 5; i++) _RankingRow(index: i, data: ranking[i], onTap: () {
                            Navigator.push(context, MaterialPageRoute(builder: (_) => ConsumptionMaterialDetailPage(rows: rows, teams: teams, itemId: ranking[i]['id'].toString(), initialTeamId: teamId)));
                          }),
                      ]),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: OutlinedButton.icon(
                      icon: const Icon(Icons.show_chart_rounded),
                      label: const Text('Ver gráficos'),
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ConsumptionGraphsPage(rows: rows, teams: teams, initialTeamId: teamId))),
                    )),
                    const SizedBox(width: 10),
                    Expanded(child: OutlinedButton.icon(
                      icon: const Icon(Icons.compare_arrows_rounded),
                      label: const Text('Comparar equipes'),
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ConsumptionTeamsComparePage(rows: rows, teams: teams))),
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
  const ConsumptionMaterialsPage({super.key, required this.rows, required this.teams, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialsPage> createState() => _ConsumptionMaterialsPageState();
}

class _ConsumptionMaterialsPageState extends State<ConsumptionMaterialsPage> {
  late String? teamId = widget.initialTeamId;
  DateTime anchor = DateTime.now();
  int periodDays = 7;
  @override
  Widget build(BuildContext context) {
    final end = DateTime(anchor.year, anchor.month, anchor.day).add(const Duration(days: 1));
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
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), children: [
        Row(children: [
          Expanded(child: _teamDropdown(widget.teams, teamId, (v) => setState(() => teamId = v))),
          const SizedBox(width: 10),
          Expanded(child: DropdownButtonFormField<int>(
            initialValue: periodDays,
            decoration: const InputDecoration(labelText: 'Período', prefixIcon: Icon(Icons.calendar_month_outlined)),
            items: const [
              DropdownMenuItem(value: 7, child: Text('7 dias')),
              DropdownMenuItem(value: 30, child: Text('30 dias')),
              DropdownMenuItem(value: 90, child: Text('3 meses')),
              DropdownMenuItem(value: 180, child: Text('6 meses')),
            ],
            onChanged: (v) => setState(() { periodDays = v ?? 7; anchor = DateTime.now(); }),
          )),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          IconButton.filledTonal(onPressed: () => setState(() => anchor = anchor.subtract(Duration(days: periodDays))), icon: const Icon(Icons.chevron_left)),
          Expanded(child: Center(child: Text('${_dateBr(start)} - ${_dateBr(end.subtract(const Duration(days: 1)))}', style: const TextStyle(fontWeight: FontWeight.w900)))),
          IconButton.filledTonal(onPressed: () => setState(() => anchor = anchor.add(Duration(days: periodDays))), icon: const Icon(Icons.chevron_right)),
        ]),
        const SizedBox(height: 10),
        _MetricCard(eyebrow: 'TOTAL CONSUMIDO EM $periodLabel', title: '', value: _formatQty(total), suffix: _mixedUnits(current), change: change, comparisonText: 'vs período anterior'),
        const SizedBox(height: 12),
        Card(child: ClipRRect(borderRadius: BorderRadius.circular(16), child: Column(children: [
          Container(color: Colors.white.withValues(alpha: .045), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10), child: const Row(children: [Expanded(flex: 5, child: Text('Material', style: TextStyle(fontSize: 12, color: Colors.white70))), Expanded(flex: 2, child: Text('Quantidade', style: TextStyle(fontSize: 12, color: Colors.white70))), Expanded(flex: 2, child: Text('Unidade', style: TextStyle(fontSize: 12, color: Colors.white70))), Expanded(flex: 3, child: Text('Vs. período ant.', textAlign: TextAlign.end, style: TextStyle(fontSize: 12, color: Colors.white70)))])),
          if (grouped.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('Nenhum consumo neste período.')),
          for (final g in grouped) _ConsumptionTableRow(data: g),
        ]))),
      ]),
    );
  }
}

class ConsumptionGraphsPage extends StatefulWidget {
  const ConsumptionGraphsPage({super.key, required this.rows, required this.teams, this.initialTeamId});
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
    final teamRows = widget.rows.where((r) => teamId == null || r['origin_team_id']?.toString() == teamId).toList();
    final now = DateTime.now();
    final end = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    final start = end.subtract(Duration(days: periodDays));
    final filtered = _filterConsumption(teamRows, null, start, end);
    final trend = _consumptionTrend(teamRows, start, end, periodDays);
    final categories = _groupCategories(filtered);
    final materials = _groupMaterials(filtered, const []);
    if (materialId != null && !materials.any((g) => g['id'].toString() == materialId)) materialId = null;
    materialId ??= materials.isNotEmpty ? materials.first['id'].toString() : null;
    final materialRows = materialId == null ? <Map<String, dynamic>>[] : teamRows.where((r) => r['item_id']?.toString() == materialId).toList();
    final materialTrend = materialId == null ? <Map<String, dynamic>>[] : _consumptionTrend(materialRows, start, end, periodDays);
    final displayTrend = tab == 2 ? materialTrend : trend;
    final totals = displayTrend.map((e) => (e['qty'] as num).toDouble()).toList();
    final total = totals.fold<double>(0, (a, b) => a + b);
    final avg = totals.isEmpty ? 0.0 : total / totals.length;
    final maxValue = totals.isEmpty ? 0.0 : totals.reduce((a, b) => a > b ? a : b);
    final avgTitle = periodDays <= 7 ? 'Média diária' : periodDays <= 30 ? 'Média por faixa' : periodDays <= 90 ? 'Média quinzenal' : 'Média mensal';
    return Scaffold(
      appBar: AppBar(title: const Text('Consumo em gráficos')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), children: [
        Row(children: [
          Expanded(child: _teamDropdown(widget.teams, teamId, (v) => setState(() => teamId = v))),
          const SizedBox(width: 10),
          Expanded(child: DropdownButtonFormField<int>(
            initialValue: periodDays,
            decoration: const InputDecoration(labelText: 'Período', prefixIcon: Icon(Icons.calendar_month_outlined)),
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
        ], selected: {tab}, onSelectionChanged: (v) => setState(() => tab = v.first)),
        if (tab == 2 && materials.isNotEmpty) ...[
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(initialValue: materialId, decoration: const InputDecoration(labelText: 'Material'), items: materials.map((g) => DropdownMenuItem(value: g['id'].toString(), child: Text('${g['code']} • ${g['name']}', overflow: TextOverflow.ellipsis))).toList(), onChanged: (v) => setState(() => materialId = v)),
        ],
        const SizedBox(height: 14),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tab == 1 ? 'Consumo por categoria' : tab == 2 ? 'Evolução por material' : 'Evolução do consumo (${_consumptionScaleLabel(periodDays)})', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 4),
          Text(tab == 1 ? 'Participação no período' : '${_dateBr(start)} - ${_dateBr(end.subtract(const Duration(days: 1)))} • ${_mixedUnits(filtered)}', style: const TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(height: 18),
          SizedBox(height: 260, child: tab == 1 ? ConsumptionDonutChart(data: categories, showLabels: true) : ConsumptionLineChart(data: displayTrend)),
        ]))),
        if (tab != 1) ...[
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: _SmallMetric(title: avgTitle, value: _formatQty(avg), suffix: _mixedUnits(filtered))),
            const SizedBox(width: 10),
            Expanded(child: _SmallMetric(title: 'Maior consumo', value: _formatQty(maxValue), suffix: _mixedUnits(filtered))),
          ]),
          const SizedBox(height: 10),
          _SmallMetric(title: 'Total no período', value: _formatQty(total), suffix: _mixedUnits(filtered)),
        ],
      ]),
    );
  }
}

class ConsumptionMaterialDetailPage extends StatefulWidget {
  const ConsumptionMaterialDetailPage({super.key, required this.rows, required this.teams, required this.itemId, this.initialTeamId});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  final String itemId;
  final String? initialTeamId;
  @override
  State<ConsumptionMaterialDetailPage> createState() => _ConsumptionMaterialDetailPageState();
}

class _ConsumptionMaterialDetailPageState extends State<ConsumptionMaterialDetailPage> {
  late String? teamId = widget.initialTeamId;
  @override
  Widget build(BuildContext context) {
    final itemRows = widget.rows.where((r) => r['item_id']?.toString() == widget.itemId && (teamId == null || r['origin_team_id']?.toString() == teamId)).toList();
    final item = itemRows.isEmpty ? null : itemRows.first['items'] as Map?;
    final currentTrend = _monthlyTrend(itemRows, 3);
    final previousTrend = _monthlyTrend(itemRows, 6).take(3).toList();
    final currentTotal = currentTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    final previousTotal = previousTrend.fold<double>(0, (a, e) => a + (e['qty'] as double));
    return Scaffold(
      appBar: AppBar(title: const Text('Detalhes do material')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), children: [
        Row(children: [
          Container(width: 66, height: 66, decoration: BoxDecoration(color: const Color(0xFF0C3766), borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.blur_linear_rounded, size: 38, color: Color(0xFF248BFF))),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(item?['name']?.toString() ?? 'Material', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20)), Text('Código: ${item?['code'] ?? ''}', style: const TextStyle(color: Colors.white54)), const SizedBox(height: 5), if ((item?['category']?.toString() ?? '').isNotEmpty) Chip(label: Text(item!['category'].toString()), visualDensity: VisualDensity.compact)])),
        ]),
        const SizedBox(height: 14),
        _teamDropdown(widget.teams, teamId, (v) => setState(() => teamId = v)),
        const SizedBox(height: 14),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Consumo de ${item?['name'] ?? 'material'} (${item?['unit'] ?? 'un'})', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 16),
          SizedBox(height: 250, child: ConsumptionGroupedBarChart(current: currentTrend, previous: previousTrend)),
        ]))),
        const SizedBox(height: 12),
        Row(children: [Expanded(child: _SmallMetric(title: 'Total no período atual', value: _formatQty(currentTotal), suffix: item?['unit']?.toString() ?? 'un')), const SizedBox(width: 10), Expanded(child: _SmallMetric(title: 'Total no período anterior', value: _formatQty(previousTotal), suffix: item?['unit']?.toString() ?? 'un'))]),
        const SizedBox(height: 10),
        _MetricCard(eyebrow: 'VARIAÇÃO NO PERÍODO', title: '', value: '${_percentChange(currentTotal, previousTotal)?.abs().toStringAsFixed(1) ?? '0.0'}%', suffix: '', change: _percentChange(currentTotal, previousTotal), comparisonText: 'comparado aos 3 meses anteriores'),
      ]),
    );
  }
}

class ConsumptionTeamsComparePage extends StatefulWidget {
  const ConsumptionTeamsComparePage({super.key, required this.rows, required this.teams});
  final List<Map<String, dynamic>> rows;
  final List<Team> teams;
  @override
  State<ConsumptionTeamsComparePage> createState() => _ConsumptionTeamsComparePageState();
}

class _ConsumptionTeamsComparePageState extends State<ConsumptionTeamsComparePage> {
  String period = 'month';
  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final start = _periodStart(now, period), end = _periodEnd(now, period);
    final current = _filterConsumption(widget.rows, null, start, end);
    final teamTotals = <Map<String, dynamic>>[];
    for (final t in widget.teams) {
      final qty = _sumConsumption(current.where((r) => r['origin_team_id']?.toString() == t.id).toList());
      teamTotals.add({'name': t.name, 'qty': qty});
    }
    teamTotals.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
    final ranking = _groupMaterials(current, const []);
    return Scaffold(
      appBar: AppBar(title: const Text('Comparativo entre equipes')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 90), children: [
        DropdownButtonFormField<String>(initialValue: period, decoration: const InputDecoration(labelText: 'Período', prefixIcon: Icon(Icons.calendar_month_outlined)), items: const [DropdownMenuItem(value: 'week', child: Text('Esta semana')), DropdownMenuItem(value: 'month', child: Text('Este mês'))], onChanged: (v) => setState(() => period = v ?? 'month')),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _SmallMetric(title: teamTotals.isEmpty ? 'Equipe' : teamTotals.first['name'].toString(), value: _formatQty(teamTotals.isEmpty ? 0 : teamTotals.first['qty'] as double), suffix: _mixedUnits(current))),
          const SizedBox(width: 10),
          Expanded(child: _SmallMetric(title: 'Todas as equipes', value: _formatQty(_sumConsumption(current)), suffix: _mixedUnits(current))),
        ]),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Consumo por equipe', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 16),
          SizedBox(height: 240, child: ConsumptionHorizontalBars(data: teamTotals)),
        ]))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Ranking de materiais (geral da empresa)', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
          const SizedBox(height: 8),
          for (int i = 0; i < ranking.length && i < 5; i++) _RankingRow(index: i, data: ranking[i]),
        ]))),
      ]),
    );
  }
}

Widget _teamDropdown(List<Team> teams, String? value, ValueChanged<String?> onChanged) => DropdownButtonFormField<String?>(
  initialValue: value,
  decoration: const InputDecoration(labelText: 'Equipe', prefixIcon: Icon(Icons.group_outlined)),
  items: [const DropdownMenuItem<String?>(value: null, child: Text('Todas as equipes')), ...teams.map((t) => DropdownMenuItem<String?>(value: t.id, child: Text(t.name, overflow: TextOverflow.ellipsis)))],
  onChanged: onChanged,
);

DateTime _periodStart(DateTime now, String period) {
  if (period == 'week') return DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
  return DateTime(now.year, now.month, 1);
}
DateTime _periodEnd(DateTime now, String period) => period == 'week' ? _periodStart(now, period).add(const Duration(days: 7)) : DateTime(now.year, now.month + 1, 1);
DateTime _rowDate(Map<String, dynamic> r) => DateTime.tryParse(r['created_at']?.toString() ?? '')?.toLocal() ?? DateTime(1970);
List<Map<String, dynamic>> _filterConsumption(List<Map<String, dynamic>> rows, String? teamId, DateTime start, DateTime end) => rows.where((r) { final d = _rowDate(r); return (teamId == null || r['origin_team_id']?.toString() == teamId) && !d.isBefore(start) && d.isBefore(end); }).toList();
double _sumConsumption(List<Map<String, dynamic>> rows) => rows.fold<double>(0, (a, r) => a + ((r['quantity'] as num?)?.toDouble() ?? 0));
double? _percentChange(double current, double previous) => previous == 0 ? null : ((current - previous) / previous * 100);
String _formatQty(double v) => v.toStringAsFixed(v % 1 == 0 ? 0 : 2).replaceAll('.', ',');
String _dateBr(DateTime d) => '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
String _consumptionPeriodLabel(int days) => days == 7 ? '7 DIAS' : days == 30 ? '30 DIAS' : days == 90 ? '3 MESES' : '6 MESES';
String _consumptionScaleLabel(int days) => days == 7 ? 'por dia' : days == 30 ? 'a cada 5 dias' : days == 90 ? 'a cada 15 dias' : 'por mês';
List<Map<String, dynamic>> _consumptionTrend(List<Map<String, dynamic>> rows, DateTime start, DateTime end, int periodDays) {
  if (periodDays >= 180) {
    final out = <Map<String, dynamic>>[];
    var cursor = DateTime(start.year, start.month, 1);
    while (cursor.isBefore(end)) {
      final next = DateTime(cursor.year, cursor.month + 1, 1);
      final bucketStart = cursor.isBefore(start) ? start : cursor;
      final bucketEnd = next.isAfter(end) ? end : next;
      if (bucketStart.isBefore(bucketEnd)) {
        out.add({'label': '${cursor.month.toString().padLeft(2, '0')}/${cursor.year.toString().substring(2)}', 'qty': _sumConsumption(_filterConsumption(rows, null, bucketStart, bucketEnd))});
      }
      cursor = next;
    }
    return out;
  }
  final bucketDays = periodDays <= 7 ? 1 : periodDays <= 30 ? 5 : 15;
  final out = <Map<String, dynamic>>[];
  var cursor = start;
  while (cursor.isBefore(end)) {
    final next = cursor.add(Duration(days: bucketDays));
    final bucketEnd = next.isAfter(end) ? end : next;
    final label = bucketDays == 1
        ? '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}'
        : '${cursor.day.toString().padLeft(2, '0')}/${cursor.month.toString().padLeft(2, '0')}';
    out.add({'label': label, 'qty': _sumConsumption(_filterConsumption(rows, null, cursor, bucketEnd))});
    cursor = next;
  }
  return out;
}
String _mixedUnits(List<Map<String, dynamic>> rows) {
  final units = <String>{};
  for (final r in rows) { final u = (r['items'] as Map?)?['unit']?.toString(); if (u != null && u.isNotEmpty) units.add(u); }
  if (units.isEmpty) return 'un/kg/L';
  return units.take(3).join('/');
}
List<Map<String, dynamic>> _groupMaterials(List<Map<String, dynamic>> current, List<Map<String, dynamic>> previous) {
  final grouped = <String, Map<String, dynamic>>{};
  for (final r in [...current, ...previous]) {
    final id = r['item_id']?.toString() ?? '';
    final item = r['items'] as Map?;
    grouped.putIfAbsent(id, () => {'id': id, 'code': item?['code']?.toString() ?? '', 'name': item?['name']?.toString() ?? 'Material', 'unit': item?['unit']?.toString() ?? 'un', 'category': item?['category']?.toString() ?? 'Outros', 'qty': 0.0, 'prev': 0.0});
  }
  for (final r in current) { final id = r['item_id']?.toString() ?? ''; if (grouped[id] != null) grouped[id]!['qty'] = (grouped[id]!['qty'] as double) + ((r['quantity'] as num?)?.toDouble() ?? 0); }
  for (final r in previous) { final id = r['item_id']?.toString() ?? ''; if (grouped[id] != null) grouped[id]!['prev'] = (grouped[id]!['prev'] as double) + ((r['quantity'] as num?)?.toDouble() ?? 0); }
  final out = grouped.values.where((g) => (g['qty'] as double) > 0).toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}
List<Map<String, dynamic>> _groupCategories(List<Map<String, dynamic>> rows) {
  final m = <String, double>{};
  for (final r in rows) { final c = ((r['items'] as Map?)?['category']?.toString().trim().isNotEmpty ?? false) ? (r['items'] as Map)['category'].toString() : 'Outros'; m[c] = (m[c] ?? 0) + ((r['quantity'] as num?)?.toDouble() ?? 0); }
  final total = m.values.fold<double>(0, (a, b) => a + b);
  final out = m.entries.map((e) => {'name': e.key, 'qty': e.value, 'pct': total == 0 ? 0.0 : e.value / total * 100}).toList();
  out.sort((a, b) => (b['qty'] as double).compareTo(a['qty'] as double));
  return out;
}
List<Map<String, dynamic>> _monthlyTrend(List<Map<String, dynamic>> rows, int months) {
  final now = DateTime.now();
  final out = <Map<String, dynamic>>[];
  for (int i = months - 1; i >= 0; i--) { final m = DateTime(now.year, now.month - i, 1); final n = DateTime(now.year, now.month - i + 1, 1); out.add({'label': '${m.month.toString().padLeft(2, '0')}/${m.year.toString().substring(2)}', 'qty': _sumConsumption(_filterConsumption(rows, null, m, n))}); }
  return out;
}

const _consumptionColors = [Color(0xFF2B8CFF), Color(0xFF59B85B), Color(0xFFFFA726), Color(0xFF8E63E7), Color(0xFF7B8CA2), Color(0xFF27C5C3)];

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.eyebrow, required this.title, required this.value, required this.suffix, required this.change, required this.comparisonText});
  final String eyebrow, title, value, suffix, comparisonText;
  final double? change;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(eyebrow, style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w800)),
    const SizedBox(height: 10),
    Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [if (title.isNotEmpty) Text(title, style: const TextStyle(fontSize: 12)), Text(value, style: const TextStyle(fontSize: 29, fontWeight: FontWeight.w900)), if (suffix.isNotEmpty) Text(suffix, style: const TextStyle(color: Colors.white54, fontSize: 11))])),
      if (change != null) Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text('${change! >= 0 ? '↑' : '↓'} ${change!.abs().toStringAsFixed(1)}%', style: TextStyle(color: change! > 0 ? const Color(0xFFFF5A52) : const Color(0xFF73D84E), fontWeight: FontWeight.w900, fontSize: 18)), Text(comparisonText, style: const TextStyle(color: Colors.white54, fontSize: 10))]) else const Text('Sem base anterior', style: TextStyle(color: Colors.white38, fontSize: 11)),
    ]),
  ])));
}
class _SmallMetric extends StatelessWidget { const _SmallMetric({required this.title, required this.value, required this.suffix}); final String title, value, suffix; @override Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(13), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white60, fontSize: 11)), const SizedBox(height: 5), Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 21)), Text(suffix, style: const TextStyle(color: Colors.white38, fontSize: 10))]))); }
class _CategoryLegendRow extends StatelessWidget { const _CategoryLegendRow({required this.index, required this.data}); final int index; final Map<String, dynamic> data; @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [Container(width: 9, height: 9, decoration: BoxDecoration(color: _consumptionColors[index % _consumptionColors.length], borderRadius: BorderRadius.circular(2))), const SizedBox(width: 7), Expanded(child: Text(data['name'].toString(), overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12))), Text('${(data['pct'] as double).toStringAsFixed(0)}%', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12))])); }
class _RankingRow extends StatelessWidget { const _RankingRow({required this.index, required this.data, this.onTap}); final int index; final Map<String, dynamic> data; final VoidCallback? onTap; @override Widget build(BuildContext context) => InkWell(onTap: onTap, child: Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(children: [Container(width: 22, height: 22, alignment: Alignment.center, decoration: BoxDecoration(color: _consumptionColors[index % _consumptionColors.length], borderRadius: BorderRadius.circular(5)), child: Text('${index + 1}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11))), const SizedBox(width: 9), Expanded(child: Text(data['name'].toString(), style: const TextStyle(fontWeight: FontWeight.w700))), Text('${_formatQty(data['qty'] as double)} ${data['unit']}', style: const TextStyle(fontWeight: FontWeight.w800))]))); }
class _ConsumptionTableRow extends StatelessWidget { const _ConsumptionTableRow({required this.data}); final Map<String, dynamic> data; @override Widget build(BuildContext context) { final q = data['qty'] as double, p = data['prev'] as double, c = _percentChange(q, p); return Container(decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.white.withValues(alpha: .06)))), padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12), child: Row(children: [Expanded(flex: 5, child: Text(data['name'].toString(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12))), Expanded(flex: 2, child: Text(_formatQty(q), style: const TextStyle(fontSize: 12))), Expanded(flex: 2, child: Text(data['unit'].toString(), style: const TextStyle(fontSize: 12))), Expanded(flex: 3, child: Text(c == null ? '— 0,0%' : '${c >= 0 ? '↑' : '↓'} ${c.abs().toStringAsFixed(1)}%', textAlign: TextAlign.end, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: c == null ? Colors.white54 : c > 0 ? const Color(0xFFFF5A52) : const Color(0xFF73D84E))) )])); } }

class ConsumptionDonutChart extends StatelessWidget {
  const ConsumptionDonutChart({super.key, required this.data, this.showLabels = false}); final List<Map<String, dynamic>> data; final bool showLabels;
  @override Widget build(BuildContext context) => CustomPaint(painter: _DonutPainter(data), child: showLabels ? Align(alignment: Alignment.bottomCenter, child: Wrap(spacing: 12, runSpacing: 6, alignment: WrapAlignment.center, children: [for (int i = 0; i < data.length && i < 6; i++) Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 8, height: 8, color: _consumptionColors[i % _consumptionColors.length]), const SizedBox(width: 5), Text('${data[i]['name']} ${(data[i]['pct'] as double).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 10))])])) : const SizedBox.expand());
}
class _DonutPainter extends CustomPainter { _DonutPainter(this.data); final List<Map<String, dynamic>> data; @override void paint(Canvas canvas, Size size) { final total = data.fold<double>(0, (a, e) => a + (e['qty'] as double)); if (total == 0) return; final c = Offset(size.width / 2, showCenter(size.height) ? size.height * .42 : size.height / 2); final r = (size.shortestSide * .36).clamp(20.0, 88.0).toDouble(); final rect = Rect.fromCircle(center: c, radius: r); var start = -1.57079632679; for (int i = 0; i < data.length; i++) { final sweep = (data[i]['qty'] as double) / total * 6.28318530718; final p = Paint()..color = _consumptionColors[i % _consumptionColors.length]..style = PaintingStyle.stroke..strokeWidth = r * .38..strokeCap = StrokeCap.butt; canvas.drawArc(rect, start, sweep, false, p); start += sweep; } } bool showCenter(double h) => h > 180; @override bool shouldRepaint(covariant _DonutPainter oldDelegate) => true; }
class ConsumptionLineChart extends StatelessWidget { const ConsumptionLineChart({super.key, required this.data}); final List<Map<String, dynamic>> data; @override Widget build(BuildContext context) => CustomPaint(painter: _LinePainter(data), child: const SizedBox.expand()); }
class _LinePainter extends CustomPainter { _LinePainter(this.data); final List<Map<String, dynamic>> data; @override void paint(Canvas canvas, Size size) { final values = data.map((e) => e['qty'] as double).toList(); final max = values.isEmpty ? 1.0 : values.fold<double>(0, (a, b) => a > b ? a : b); final left = 34.0, right = 10.0, top = 12.0, bottom = 28.0; final w = size.width - left - right, h = size.height - top - bottom; final grid = Paint()..color = Colors.white.withValues(alpha: .07)..strokeWidth = 1; for (int i=0;i<5;i++){final y=top+h*i/4;canvas.drawLine(Offset(left,y),Offset(left+w,y),grid);} if(data.isEmpty)return; final path=Path(); final fill=Path(); for(int i=0;i<data.length;i++){final x=left+(data.length==1?0.0:w*i/(data.length-1));final y=top+h-(max==0?0.0:(data[i]['qty'] as double)/max*h);if(i==0){path.moveTo(x,y);fill.moveTo(x,top+h);fill.lineTo(x,y);}else{path.lineTo(x,y);fill.lineTo(x,y);} final tp=TextPainter(text:TextSpan(text:data[i]['label'].toString(),style:const TextStyle(fontSize:9,color:Colors.white54)),textDirection:TextDirection.ltr)..layout();tp.paint(canvas,Offset(x-tp.width/2,top+h+8)); final vp=TextPainter(text:TextSpan(text:_formatQty(data[i]['qty'] as double),style:const TextStyle(fontSize:9,color:Colors.white70,fontWeight:FontWeight.w700)),textDirection:TextDirection.ltr)..layout();vp.paint(canvas,Offset(x-vp.width/2,y-17)); }
    fill.lineTo(left+w,top+h);fill.close();canvas.drawPath(fill,Paint()..shader=LinearGradient(begin:Alignment.topCenter,end:Alignment.bottomCenter,colors:[const Color(0xFF258CFF).withValues(alpha:.35),const Color(0xFF258CFF).withValues(alpha:.02)]).createShader(Rect.fromLTWH(left,top,w,h))); canvas.drawPath(path,Paint()..color=const Color(0xFF258CFF)..strokeWidth=2.2..style=PaintingStyle.stroke); for(int i=0;i<data.length;i++){final x=left+(data.length==1?0.0:w*i/(data.length-1));final y=top+h-(max==0?0.0:(data[i]['qty'] as double)/max*h);canvas.drawCircle(Offset(x,y),4,Paint()..color=const Color(0xFF258CFF));canvas.drawCircle(Offset(x,y),2,Paint()..color=Colors.white);}
  } @override bool shouldRepaint(covariant _LinePainter oldDelegate)=>true; }
class ConsumptionGroupedBarChart extends StatelessWidget { const ConsumptionGroupedBarChart({super.key, required this.current, required this.previous}); final List<Map<String,dynamic>> current, previous; @override Widget build(BuildContext context)=>CustomPaint(painter:_GroupedBarPainter(current,previous),child:const SizedBox.expand()); }
class _GroupedBarPainter extends CustomPainter { _GroupedBarPainter(this.current,this.previous); final List<Map<String,dynamic>> current,previous; @override void paint(Canvas canvas,Size size){ final n=current.length; if(n==0)return; final vals=[...current.map((e)=>e['qty'] as double),...previous.map((e)=>e['qty'] as double)]; final max=vals.fold<double>(0,(a,b)=>a>b?a:b); final base=size.height-28, top=18.0, h=base-top, groupW=size.width/n; for(int i=0;i<n;i++){ final a=current[i]['qty'] as double, b=i<previous.length?previous[i]['qty'] as double:0.0; final double bhA=max==0?0.0:a/max*h, bhB=max==0?0.0:b/max*h; final x=i*groupW+groupW*.25; canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x,base-bhA,groupW*.22,bhA),const Radius.circular(4)),Paint()..color=const Color(0xFF2B8CFF));canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x+groupW*.27,base-bhB,groupW*.22,bhB),const Radius.circular(4)),Paint()..color=const Color(0xFF687584)); final tp=TextPainter(text:TextSpan(text:current[i]['label'].toString(),style:const TextStyle(fontSize:9,color:Colors.white54)),textDirection:TextDirection.ltr)..layout();tp.paint(canvas,Offset(i*groupW+(groupW-tp.width)/2,base+8)); }} @override bool shouldRepaint(covariant _GroupedBarPainter oldDelegate)=>true; }
class ConsumptionHorizontalBars extends StatelessWidget { const ConsumptionHorizontalBars({super.key, required this.data}); final List<Map<String,dynamic>> data; @override Widget build(BuildContext context){ final max=data.fold<double>(0,(a,e)=>(e['qty'] as double)>a?(e['qty'] as double):a); return Column(mainAxisAlignment:MainAxisAlignment.center,children:[for(int i=0;i<data.length;i++) Padding(padding:const EdgeInsets.symmetric(vertical:7),child:Row(children:[SizedBox(width:115,child:Text(data[i]['name'].toString(),overflow:TextOverflow.ellipsis,style:const TextStyle(fontSize:11))),Expanded(child:LayoutBuilder(builder:(context,c)=>Align(alignment:Alignment.centerLeft,child:Container(height:24,width:max==0?2.0:c.maxWidth*(data[i]['qty'] as double)/max,decoration:BoxDecoration(color:i==1?const Color(0xFF2B8CFF):i==0?const Color(0xFF687584):_consumptionColors[i%_consumptionColors.length],borderRadius:BorderRadius.circular(3)))))),const SizedBox(width:7),SizedBox(width:52,child:Text(_formatQty(data[i]['qty'] as double),style:const TextStyle(fontSize:10,fontWeight:FontWeight.w800))) ]))]); } }

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key, required this.repo, required this.stream, required this.isAdmin});
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
            ('replenishment', 'Reposição COSEM → equipe', Icons.inventory_2_outlined),
            ('transfer', 'Transferência de equipamento', Icons.swap_horiz_rounded),
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
                  const Text('Filtrar histórico', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  const Text('Marque uma ou mais operações. Sem seleção, o histórico mostra tudo.', style: TextStyle(color: Colors.white60)),
                  const SizedBox(height: 10),
                  for (final option in options)
                    CheckboxListTile(
                      value: draft.contains(option.$1),
                      secondary: Icon(option.$3),
                      title: Text(option.$2),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      onChanged: (checked) => setSheet(() {
                        if (checked ?? false) { draft.add(option.$1); } else { draft.remove(option.$1); }
                      }),
                    ),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(child: OutlinedButton(onPressed: () => setSheet(draft.clear), child: const Text('Limpar'))),
                    const SizedBox(width: 10),
                    Expanded(child: FilledButton(onPressed: () => Navigator.pop(context, draft), child: const Text('Aplicar'))),
                  ]),
                ],
              ),
            ),
          );
        },
      ),
    );
    if (result != null && mounted) setState(() { movementFilters..clear()..addAll(result); });
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
        if (!dSnap.hasData) return const Center(child: CircularProgressIndicator());
        final teams = dSnap.data!.teams;

        return FutureBuilder<List<Map<String, dynamic>>>(
          future: widget.repo.fetchHistory(),
          builder: (context, snap) {
            if (snap.hasError) return ErrorState(error: snap.error);
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            final q = search.text.trim().toLowerCase();
            final rows = snap.data!
                .where((row) => q.isEmpty || historySearchText(row).contains(q))
                .where((row) => movementFilters.isEmpty || movementFilters.contains(row['movement_type']?.toString() ?? ''))
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
                      hintText: 'Pesquisar histórico por nome, código ou movimentação',
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
                          label: Text(movementFilters.isEmpty ? 'Filtrar histórico' : 'Filtros (${movementFilters.length})'),
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
                        subtitle: 'As entradas e movimentações aparecerão aqui.',
                      ),
                    )
                  else if (rows.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: EmptyState(
                        icon: Icons.search_off,
                        title: 'Nenhuma movimentação encontrada',
                        subtitle: 'Tente outro nome, código, equipe ou tipo de movimentação.',
                      ),
                    )
                  else
                    for (final row in rows)
                      Builder(builder: (context) {
                        final isMaterial = row['_kind'] == 'material';
                        final title = isMaterial
                            ? ((row['items'] as Map?)?['name']?.toString() ?? 'Material')
                            : (((row['assets'] as Map?)?['items'] as Map?)?['name']?.toString() ?? 'Equipamento');
                        final item = isMaterial ? row['items'] as Map? : (row['assets'] as Map?)?['items'] as Map?;
                        final code = item?['code']?.toString() ?? '';
                        final assetCode = (row['assets'] as Map?)?['asset_code']?.toString() ?? '';
                        final origin = (row['origin'] as Map?)?['name']?.toString();
                        final destination = (row['destination'] as Map?)?['name']?.toString();
                        final movementType = row['movement_type']?.toString() ?? '';
                        final accent = historyAccentColor(isMaterial, movementType);
                        final mainAction = [
                          movementLabel(movementType),
                          if (origin != null) origin,
                          if (destination != null) destination,
                        ].join(' → ');

                        return Card(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                            side: BorderSide(color: accent.withValues(alpha: .55)),
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
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
                                        const SizedBox(height: 3),
                                        Text(
                                          [if (code.isNotEmpty) code, if (!isMaterial && assetCode.isNotEmpty) assetCode].join(' • '),
                                          style: TextStyle(color: accent, fontWeight: FontWeight.w800, fontSize: 12),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(mainAction, style: const TextStyle(fontWeight: FontWeight.w700)),
                                        if (isMaterial) ...[
                                          const SizedBox(height: 3),
                                          Text('Quantidade: ${row['quantity'] ?? 0}'),
                                        ],
                                        const SizedBox(height: 7),
                                        Row(
                                          children: [
                                            const Icon(Icons.schedule, size: 15, color: Colors.white54),
                                            const SizedBox(width: 5),
                                            Text(formatHistoryDateTime(row['created_at']), style: const TextStyle(color: Colors.white60, fontSize: 12)),
                                          ],
                                        ),
                                        if (row['note'] != null && row['note'].toString().trim().isNotEmpty) ...[
                                          const SizedBox(height: 5),
                                          Text(row['note'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white70)),
                                        ],
                                        const SizedBox(height: 5),
                                        const Text('Toque para ver os detalhes', style: TextStyle(color: Colors.white38, fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                  if (widget.isAdmin)
                                    PopupMenuButton<String>(
                                      onSelected: (action) async {
                                        if (action == 'edit') {
                                          try {
                                            if (isMaterial) {
                                              await showMaterialHistoryEdit(context, widget.repo, teams, row);
                                            } else {
                                              await showAssetHistoryEdit(context, widget.repo, teams, row);
                                            }
                                            reload();
                                          } catch (e) {
                                            if (context.mounted) showError(context, e);
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
                                                await widget.repo.deleteMaterialHistory(row['id'].toString());
                                              } else {
                                                await widget.repo.deleteAssetHistory(row['id'].toString());
                                              }
                                              reload();
                                            } catch (e) {
                                              if (context.mounted) showError(context, e);
                                            }
                                          }
                                        }
                                      },
                                      itemBuilder: (_) => const [
                                        PopupMenuItem(value: 'edit', child: Text('Corrigir')),
                                        PopupMenuItem(value: 'delete', child: Text('Excluir')),
                                      ],
                                    )
                                  else
                                    const Padding(
                                      padding: EdgeInsets.only(top: 18, right: 6),
                                      child: Icon(Icons.chevron_right, color: Colors.white38),
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

Future<Map<String, dynamic>?> showSearchableMaterialPicker(BuildContext context, List<Map<String, dynamic>> catalog) async {
  return showModalBottomSheet<Map<String, dynamic>>(
    context: context, isScrollControlled: true, showDragHandle: true,
    builder: (context) => _MaterialPickerSheet(catalog: catalog),
  );
}
class _MaterialPickerSheet extends StatefulWidget {
  const _MaterialPickerSheet({required this.catalog}); final List<Map<String,dynamic>> catalog;
  @override State<_MaterialPickerSheet> createState()=>_MaterialPickerSheetState();
}
class _MaterialPickerSheetState extends State<_MaterialPickerSheet>{
  String q='';
  @override Widget build(BuildContext context){final rows=widget.catalog.where((m){final t='${m['code']} ${m['name']} ${m['unit']}'.toLowerCase();return q.trim().isEmpty||t.contains(q.trim().toLowerCase());}).toList();return SafeArea(child:Padding(padding:EdgeInsets.fromLTRB(16,4,16,MediaQuery.viewInsetsOf(context).bottom+16),child:SizedBox(height:MediaQuery.sizeOf(context).height*.65,child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('Escolher material',style:TextStyle(fontSize:22,fontWeight:FontWeight.w900)),const SizedBox(height:12),TextField(autofocus:true,onChanged:(v)=>setState(()=>q=v),decoration:const InputDecoration(prefixIcon:Icon(Icons.search),hintText:'Pesquisar por nome ou código…')),const SizedBox(height:10),Expanded(child:rows.isEmpty?const Center(child:Text('Nenhum material encontrado.')):ListView.separated(itemCount:rows.length,separatorBuilder:(_,__)=>const Divider(height:1),itemBuilder:(_,i){final m=rows[i];return ListTile(title:Text('${m['code']} • ${m['name']}',style:const TextStyle(fontWeight:FontWeight.w800)),subtitle:Text('Unidade: ${m['unit'] ?? 'un'}'),onTap:()=>Navigator.pop(context,m));}))]))));}
}

Future<void> showMaterialDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  String? initialTeamId,
) async {
  final catalog = await repo.fetchMaterialCatalog();
  if (!context.mounted) return;

  final code = TextEditingController();
  final name = TextEditingController();
  final quantity = TextEditingController(text: '1');
  final unit = TextEditingController(text: 'un');
  String? teamId = initialTeamId ?? (teams.isNotEmpty ? teams.first.id : null);
  bool existing = catalog.isNotEmpty;
  String? selectedId;
  bool busy = false;
  String? error;

  await showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: const Text('Entrada de material'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (catalog.isNotEmpty) ...[
                SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(value: true, label: Text('Existente')),
                    ButtonSegment(value: false, label: Text('Novo')),
                  ],
                  selected: {existing},
                  onSelectionChanged: busy
                      ? null
                      : (v) => setLocal(() {
                            existing = v.first;
                            selectedId = null;
                            code.clear();
                            name.clear();
                            unit.text = 'un';
                          }),
                ),
                const SizedBox(height: 12),
              ],
              if (existing && catalog.isNotEmpty)
                InkWell(
                  onTap: busy ? null : () async {
                    final selected = await showSearchableMaterialPicker(context, catalog);
                    if (selected == null) return;
                    setLocal(() {
                      selectedId = selected['id'].toString();
                      code.text = selected['code']?.toString() ?? '';
                      name.text = selected['name']?.toString() ?? '';
                      unit.text = selected['unit']?.toString() ?? 'un';
                    });
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Material cadastrado', prefixIcon: Icon(Icons.search)),
                    child: Row(children:[Expanded(child:Text(selectedId == null ? 'Pesquisar por nome ou código…' : '${code.text} • ${name.text}', overflow: TextOverflow.ellipsis)), const Icon(Icons.arrow_drop_down)]),
                  ),
                )
              else ...[
                TextField(
                  controller: code,
                  decoration: const InputDecoration(labelText: 'Código'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Material'),
                ),
              ],
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe'),
                items: teams
                    .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setLocal(() => teamId = v),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: quantity,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Quantidade'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: unit,
                      enabled: !(existing && catalog.isNotEmpty),
                      decoration: const InputDecoration(labelText: 'Unidade'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Um material possui um único código. Cada equipe mantém apenas sua própria quantidade.',
                style: TextStyle(fontSize: 12, color: Colors.white60),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
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
                    final q = int.tryParse(quantity.text.trim());
                    final validation = (existing && catalog.isNotEmpty && selectedId == null)
                        ? 'Selecione um material.'
                        : requiredText(code.text, 'Código') ??
                            requiredText(name.text, 'Material') ??
                            (teamId == null ? 'Selecione uma equipe.' : null) ??
                            positiveQuantity(q);
                    if (validation != null) {
                      setLocal(() => error = validation);
                      return;
                    }
                    setLocal(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await repo.createMaterial(
                        code: code.text,
                        name: name.text,
                        teamId: teamId!,
                        quantity: q!,
                        unit: unit.text,
                      );
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            child: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Adicionar'),
          ),
        ],
      ),
    ),
  );
}

Future<void> showEquipmentDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  String? initialTeamId,
) async {
  final code = TextEditingController();
  final name = TextEditingController();
  final assetCode = TextEditingController();
  final serial = TextEditingController();
  final rentalCompany = TextEditingController();
  final rentalEndDate = TextEditingController();
  final notes = TextEditingController();
  String ownershipType = 'owned';
  String? teamId = initialTeamId ?? (teams.isNotEmpty ? teams.first.id : null);
  bool busy = false;
  String? error;

  await showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: const Text('Novo equipamento'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: code, decoration: const InputDecoration(labelText: 'Código do tipo')),
              const SizedBox(height: 10),
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Equipamento')),
              const SizedBox(height: 10),
              TextField(
                controller: assetCode,
                decoration: const InputDecoration(labelText: 'Patrimônio / identificação'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: serial,
                decoration: const InputDecoration(labelText: 'Número de série (opcional)'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(initialValue: ownershipType, decoration: const InputDecoration(labelText: 'Propriedade'), items: const [DropdownMenuItem(value: 'owned', child: Text('Próprio da empresa')), DropdownMenuItem(value: 'rented', child: Text('Equipamento alugado'))], onChanged: busy ? null : (v) => setLocal(() => ownershipType = v ?? 'owned')),
              if (ownershipType == 'rented') ...[const SizedBox(height: 10), TextField(controller: rentalCompany, decoration: const InputDecoration(labelText: 'Empresa locadora')), const SizedBox(height: 10), TextField(controller: rentalEndDate, decoration: const InputDecoration(labelText: 'Fim da locação', hintText: 'AAAA-MM-DD'))],
              const SizedBox(height: 10),
              TextField(controller: notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Observações (opcional)')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe'),
                items: teams
                    .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                    .toList(),
                onChanged: busy ? null : (v) => setLocal(() => teamId = v),
              ),
              const SizedBox(height: 8),
              const Text(
                'O código identifica o tipo/modelo; o patrimônio identifica o equipamento físico.',
                style: TextStyle(fontSize: 12, color: Colors.white60),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
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
                    final validation = requiredText(code.text, 'Código') ??
                        requiredText(name.text, 'Equipamento') ??
                        requiredText(assetCode.text, 'Patrimônio') ??
                        (ownershipType == 'rented' && rentalCompany.text.trim().isEmpty ? 'Informe a empresa locadora.' : null) ??
                        (teamId == null ? 'Selecione a equipe.' : null);
                    if (validation != null) {
                      setLocal(() => error = validation);
                      return;
                    }
                    setLocal(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await repo.createEquipment(
                        code: code.text,
                        name: name.text,
                        assetCode: assetCode.text,
                        serialNumber: serial.text,
                        teamId: teamId!,
                        ownershipType: ownershipType,
                        rentalCompany: rentalCompany.text,
                        rentalEndDate: rentalEndDate.text,
                        notes: notes.text,
                      );
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            child: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Criar'),
          ),
        ],
      ),
    ),
  );
}

Future<void> showMaterialActionsDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  MaterialStock material,
  String role,
  String? userTeamId,
) async {
  final current = findTeam(teams, material.teamId);
  final centralMatches = teams.where((t) => t.isCentral).toList();
  final central = centralMatches.isEmpty ? null : centralMatches.first;
  final canConsume = role == 'admin' || role == 'engineer' || material.teamId == userTeamId;
  final canReplenish = (role == 'admin' || role == 'engineer') && current?.isCentral == true && central != null;

  final action = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            title: Text(material.name),
            subtitle: Text('${current?.name ?? 'Local'} • ${material.quantity} ${material.unit}'),
          ),
          if (canConsume)
            ListTile(
              leading: const Icon(Icons.remove_circle_outline, color: Color(0xFF52A9FF)),
              title: const Text('Registrar consumo'),
              subtitle: const Text('Baixa o material desta localização.'),
              onTap: () => Navigator.pop(sheetContext, 'consume'),
            ),
          if (canReplenish)
            ListTile(
              leading: const Icon(Icons.local_shipping_outlined, color: Color(0xFF52A9FF)),
              title: const Text('Repor equipe'),
              subtitle: const Text('Move estoque da COSEM para uma equipe.'),
              onTap: () => Navigator.pop(sheetContext, 'replenish'),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (!context.mounted || action == null) return;

  if (action == 'consume') {
    await showMaterialQuantityDialog(
      context,
      title: 'Consumo de ${material.name}',
      maximum: material.quantity,
      actionLabel: 'Registrar consumo',
      onConfirm: (quantity, note, _) => repo.consumeMaterial(
        itemId: material.itemId,
        teamId: material.teamId,
        quantity: quantity,
        note: note,
      ),
    );
  } else if (action == 'replenish' && central != null) {
    final destinations = teams.where((t) => !t.isCentral).toList();
    if (destinations.isEmpty) return;
    await showMaterialQuantityDialog(
      context,
      title: 'Reposição de ${material.name}',
      maximum: material.quantity,
      actionLabel: 'Repor equipe',
      destinations: destinations,
      onConfirm: (quantity, note, destinationTeamId) => repo.replenishMaterial(
        itemId: material.itemId,
        centralTeamId: central.id,
        destinationTeamId: destinationTeamId!,
        quantity: quantity,
        note: note,
      ),
    );
  }
}

Future<void> showMaterialQuantityDialog(
  BuildContext context, {
  required String title,
  required int maximum,
  required String actionLabel,
  List<Team>? destinations,
  required Future<void> Function(int quantity, String? note, String? destinationTeamId) onConfirm,
}) async {
  final qty = TextEditingController(text: '1');
  final note = TextEditingController();
  String? destinationTeamId = (destinations != null && destinations.isNotEmpty) ? destinations.first.id : null;
  bool busy = false;
  String? error;

  await showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: Text(title),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (destinations != null && destinations.isNotEmpty) ...[
                DropdownButtonFormField<String>(
                  initialValue: destinationTeamId,
                  decoration: const InputDecoration(labelText: 'Equipe de destino'),
                  items: destinations
                      .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => destinationTeamId = v),
                ),
                const SizedBox(height: 10),
              ],
              TextField(
                controller: qty,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Quantidade (máx. $maximum)'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: note,
                decoration: const InputDecoration(labelText: 'Observação (opcional)'),
              ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
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
                    final quantity = int.tryParse(qty.text);
                    if (quantity == null || quantity <= 0 || quantity > maximum) {
                      setLocal(() => error = 'Quantidade inválida.');
                      return;
                    }
                    if (destinations != null && destinationTeamId == null) {
                      setLocal(() => error = 'Selecione a equipe de destino.');
                      return;
                    }
                    setLocal(() { busy = true; error = null; });
                    try {
                      await onConfirm(quantity, note.text, destinationTeamId);
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            child: Text(actionLabel),
          ),
        ],
      ),
    ),
  );
}

Future<void> showEquipmentActionsSheet(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  EquipmentAsset equipment, {
  required String role,
  required String? userTeamId,
}) async {
  final isMaintenance = equipment.status == 'maintenance';
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(equipment.name, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text('Patrimônio ${equipment.assetCode}', style: const TextStyle(color: Colors.white60)),
            const SizedBox(height: 14),
            if (!isMaintenance)
              ListTile(
                leading: const Icon(Icons.swap_horiz_rounded),
                title: const Text('Transferir equipamento'),
                subtitle: const Text('Mover o patrimônio para outra equipe ou local'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  await showEquipmentTransferDialog(context, repo, teams, equipment);
                },
              ),
            if (!isMaintenance)
              ListTile(
                leading: const Icon(Icons.build_rounded, color: Color(0xFFF5B942)),
                title: const Text('Enviar para manutenção'),
                subtitle: const Text('Mantém o patrimônio rastreado e altera o status para Em manutenção'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  await showEquipmentMaintenanceDialog(context, repo, equipment);
                },
              ),
            if (isMaintenance)
              ListTile(
                leading: const Icon(Icons.keyboard_return_rounded, color: Color(0xFF52A9FF)),
                title: const Text('Retornar da manutenção'),
                subtitle: const Text('Escolha a equipe/local de retorno e disponibilize o equipamento novamente'),
                onTap: () async {
                  Navigator.pop(sheetContext);
                  final destinations = role == 'leader'
                      ? teams.where((t) => t.id == userTeamId).toList()
                      : teams;
                  await showEquipmentMaintenanceReturnDialog(context, repo, destinations, equipment);
                },
              ),
          ],
        ),
      ),
    ),
  );
}

Future<void> showEquipmentMaintenanceDialog(
  BuildContext context,
  MetalloRepository repo,
  EquipmentAsset equipment,
) async {
  final note = TextEditingController();
  bool busy = false;
  String? error;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: const Text('Enviar para manutenção'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${equipment.name} • ${equipment.assetCode}', style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('O patrimônio continuará vinculado à equipe atual, mas ficará indisponível até o retorno da manutenção.', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 12),
            TextField(
              controller: note,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Motivo / observação', hintText: 'Ex.: troca de rolamento, revisão elétrica...'),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
        ),
        actions: [
          TextButton(onPressed: busy ? null : () => Navigator.pop(dialogContext), child: const Text('Cancelar')),
          FilledButton.icon(
            onPressed: busy
                ? null
                : () async {
                    setLocal(() { busy = true; error = null; });
                    try {
                      await repo.sendEquipmentToMaintenance(assetId: equipment.id, note: note.text);
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      if (dialogContext.mounted) setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            icon: const Icon(Icons.build_rounded),
            label: const Text('Enviar'),
          ),
        ],
      ),
    ),
  );
  note.dispose();
}

Future<void> showEquipmentMaintenanceReturnDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  EquipmentAsset equipment,
) async {
  if (teams.isEmpty) {
    showError(context, Exception('Nenhuma equipe/local disponível para receber o equipamento.'));
    return;
  }
  String to = teams.any((t) => t.id == equipment.teamId) ? equipment.teamId : teams.first.id;
  final note = TextEditingController();
  bool busy = false;
  String? error;
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: const Text('Retornar da manutenção'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: to,
              decoration: const InputDecoration(labelText: 'Equipe/local de retorno'),
              items: teams.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
              onChanged: busy ? null : (v) => setLocal(() => to = v!),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: note,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Observação do retorno', hintText: 'Ex.: manutenção concluída, equipamento revisado...'),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
        ),
        actions: [
          TextButton(onPressed: busy ? null : () => Navigator.pop(dialogContext), child: const Text('Cancelar')),
          FilledButton.icon(
            onPressed: busy
                ? null
                : () async {
                    setLocal(() { busy = true; error = null; });
                    try {
                      await repo.returnEquipmentFromMaintenance(assetId: equipment.id, toTeamId: to, note: note.text);
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      if (dialogContext.mounted) setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            icon: const Icon(Icons.keyboard_return_rounded),
            label: const Text('Retornar'),
          ),
        ],
      ),
    ),
  );
  note.dispose();
}

Future<void> showEquipmentTransferDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  EquipmentAsset equipment,
) async {
  final destinations = teams.where((t) => t.id != equipment.teamId).toList();
  if (destinations.isEmpty) return;
  String to = destinations.first.id;
  bool busy = false;
  String? error;

  await showDialog(
    context: context,
    builder: (dialogContext) => StatefulBuilder(
      builder: (context, setLocal) => AlertDialog(
        title: Text('Transferir ${equipment.name}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: to,
              decoration: const InputDecoration(labelText: 'Equipe de destino'),
              items: destinations
                  .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                  .toList(),
              onChanged: busy ? null : (v) => setLocal(() => to = v!),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
                    setLocal(() {
                      busy = true;
                      error = null;
                    });
                    try {
                      await repo.transferEquipment(assetId: equipment.id, toTeamId: to);
                      if (dialogContext.mounted) Navigator.pop(dialogContext);
                    } catch (e) {
                      setLocal(() => error = friendlyError(e));
                    } finally {
                      if (dialogContext.mounted) setLocal(() => busy = false);
                    }
                  },
            child: const Text('Transferir'),
          ),
        ],
      ),
    ),
  );
}

Future<void> showUserEditDialog(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> user,
) async {
  final name = TextEditingController(text: user['full_name']?.toString() ?? '');
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
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Nome')),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: role,
                decoration: const InputDecoration(labelText: 'Cargo'),
                items: const [
                  DropdownMenuItem(value: 'admin', child: Text('Admin')),
                  DropdownMenuItem(value: 'engineer', child: Text('Engenheiro')),
                  DropdownMenuItem(value: 'leader', child: Text('Encarregado')),
                  DropdownMenuItem(value: 'collaborator', child: Text('Colaborador')),
                ],
                onChanged: busy ? null : (v) => setLocal(() => role = v!),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: teamId,
                decoration: const InputDecoration(labelText: 'Equipe'),
                items: teams
                    .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
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
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
}

Future<void> showTeamDialog(
  BuildContext context,
  MetalloRepository repo, {
  Team? team,
}) async {
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
            TextField(controller: name, decoration: const InputDecoration(labelText: 'Nome')),
            const SizedBox(height: 10),
            TextField(
              controller: desc,
              decoration: const InputDecoration(labelText: 'Descrição (opcional)'),
            ),
            if (error != null) ...[
              const SizedBox(height: 10),
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
}

Future<void> showMaterialHistoryEdit(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
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
              if (type == 'transfer' || type == 'exit' || type == 'maintenance') ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: originId,
                  decoration: const InputDecoration(labelText: 'Equipe de origem'),
                  items: teams
                      .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => originId = v),
                ),
              ],
              if (type == 'transfer' || type == 'entry' || type == 'return') ...[
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: destinationId,
                  decoration: const InputDecoration(labelText: 'Equipe de destino'),
                  items: teams
                      .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                      .toList(),
                  onChanged: busy ? null : (v) => setLocal(() => destinationId = v),
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: note,
                decoration: const InputDecoration(labelText: 'Observação'),
              ),
              if (error != null)
                Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
}

Future<void> showAssetHistoryEdit(
  BuildContext context,
  MetalloRepository repo,
  List<Team> teams,
  Map<String, dynamic> row,
) async {
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
                  .map((t) => DropdownMenuItem(value: t.id, child: Text(t.name)))
                  .toList(),
              onChanged: busy ? null : (v) => setLocal(() => teamId = v),
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: status,
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'available', child: Text('Disponível')),
                DropdownMenuItem(value: 'in_use', child: Text('Em uso')),
                DropdownMenuItem(value: 'maintenance', child: Text('Manutenção')),
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
              Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
}

class EquipmentOwnershipBadge extends StatelessWidget {
  const EquipmentOwnershipBadge({super.key, required this.type}); final String type;
  @override Widget build(BuildContext context) { final rented = type == 'rented'; return Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: rented ? const Color(0xFF3A2E13) : const Color(0xFF173326), borderRadius: BorderRadius.circular(999)), child: Text(rented ? 'Alugado' : 'Próprio', style: TextStyle(color: rented ? const Color(0xFFFFCC66) : const Color(0xFF72D6A0), fontSize: 11, fontWeight: FontWeight.w800))); }
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    return Chip(label: Text(statusLabel(status)));
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            Icon(icon, size: 64, color: const Color(0xFF1687FF)),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60),
            ),
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error});
  final Object? error;

  @override
  Widget build(BuildContext context) {
    if (_isConnectivityError(error)) {
      return const OfflineState();
    }
    return EmptyState(
      icon: Icons.error_outline,
      title: 'Não foi possível carregar',
      subtitle: friendlyError(error),
    );
  }
}

class OfflineState extends StatelessWidget {
  const OfflineState({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 430),
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 18),
            decoration: BoxDecoration(
              color: const Color(0xFF121722),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFF2A3445)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 20,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: AspectRatio(
                    aspectRatio: 4 / 3,
                    child: Image.asset(
                      'assets/offline_worker.jpg',
                      fit: BoxFit.cover,
                      alignment: const Alignment(0, -0.18),
                      filterQuality: FilterQuality.medium,
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    'tá liso? Não pagou a internet foi?',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      height: 1.12,
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    'Verifique sua conexão e tente novamente.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white60,
                      fontSize: 14,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ErrorPage extends StatelessWidget {
  const ErrorPage({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 64),
              const SizedBox(height: 14),
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 18),
              FilledButton(onPressed: onRetry, child: const Text('Tentar novamente')),
              TextButton(
                onPressed: () => Supabase.instance.client.auth.signOut(),
                child: const Text('Sair'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Team? findTeam(List<Team> teams, String id) {
  for (final t in teams) {
    if (t.id == id) return t;
  }
  return null;
}

String firstName(String name) {
  final clean = name.trim();
  return clean.isEmpty ? 'Usuário' : clean.split(RegExp(r'\s+')).first;
}

String roleLabel(String role) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'engineer':
      return 'Engenheiro';
    case 'leader':
      return 'Encarregado';
    default:
      return 'Colaborador';
  }
}

String statusLabel(String status) {
  const labels = {
    'available': 'Disponível',
    'in_use': 'Em uso',
    'maintenance': 'Manutenção',
    'damaged': 'Danificado',
    'lost': 'Perdido',
    'retired': 'Baixado',
  };
  return labels[status] ?? status;
}

String movementLabel(String type) {
  const labels = {
    'entry': 'Entrada',
    'exit': 'Saída',
    'transfer': 'Transferência',
    'return': 'Retorno',
    'maintenance': 'Manutenção',
    'assign': 'Atribuição',
    'status_change': 'Status',
    'consumption': 'Consumo',
    'replenishment': 'Reposição',
    'adjustment': 'Ajuste',
  };
  return labels[type] ?? type;
}

bool _isConnectivityError(Object? error) {
  final text = (error?.toString() ?? '').toLowerCase();
  return text.contains('socketexception') ||
      text.contains('failed host lookup') ||
      text.contains('handshakeexception') ||
      text.contains('handshake error') ||
      text.contains('certificate_verify_failed') ||
      text.contains('connection refused') ||
      text.contains('connection reset') ||
      text.contains('network is unreachable') ||
      text.contains('connection timed out') ||
      text.contains('timed out');
}

String friendlyError(Object? error) {
  final t = error.toString().replaceFirst('Exception: ', '');
  if (t.contains('email_not_confirmed') || t.toLowerCase().contains('email not confirmed')) {
    return 'Seu cadastro foi criado, mas o e-mail ainda não foi confirmado. Confirme pelo link enviado ao seu e-mail e, depois, aguarde a liberação do administrador.';
  }
  if (t.contains('invalid_credentials') || t.toLowerCase().contains('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (t.contains('user_already_exists') || t.toLowerCase().contains('user already registered')) {
    return 'Já existe uma conta cadastrada com este e-mail.';
  }
  if (t.contains('weak_password')) {
    return 'A senha não atende aos requisitos configurados no servidor.';
  }
  if (t.contains('admin_required')) return 'Apenas o administrador pode fazer isso.';
  if (t.contains('forbidden_role')) return 'Seu cargo não possui permissão para esta ação.';
  if (t.contains('forbidden_team') || t.contains('forbidden_origin_team')) {
    return 'Você só pode operar a sua própria equipe.';
  }
  if (t.contains('team_has_inventory')) return 'A equipe ainda possui materiais em estoque.';
  if (t.contains('team_has_assets')) return 'A equipe ainda possui equipamentos.';
  if (t.contains('team_has_active_users')) return 'A equipe ainda possui usuários ativos.';
  if (t.contains('only_latest_asset_movement_can_change')) {
    return 'Por segurança, somente a movimentação mais recente deste equipamento pode ser corrigida ou excluída.';
  }
  if (t.contains('cannot_reverse_destination_stock')) {
    return 'Não é possível desfazer este histórico porque o estoque atual já foi consumido ou transferido.';
  }
  if (t.contains('insufficient_stock')) return 'Quantidade insuficiente na localização de origem.';
  if (t.contains('item_has_stock')) return 'Não é possível excluir: este material ainda possui saldo em uma localização.';
  if (t.contains('item_has_assets')) return 'Não é possível excluir: este cadastro ainda possui equipamentos ativos.';
  if (t.contains('duplicate key') || t.contains('23505')) {
    return 'Este código ou patrimônio já está em uso.';
  }
  if (_isConnectivityError(error)) {
    return 'Sem conexão com o servidor. Verifique sua internet.';
  }
  return t;
}

Future<bool?> confirm(BuildContext context, String title, String text) {
  return showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: Text(text),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Confirmar'),
        ),
      ],
    ),
  );
}

void showError(BuildContext context, Object error) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(friendlyError(error))),
  );
}
