part of '../../app.dart';

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

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

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
    setState(() {
      loading = true;
      error = null;
      message = null;
    });
    try {
      await Supabase.instance.client.auth.resetPasswordForEmail(
        address,
        redirectTo: 'com.gunswiz.metallo://auth-callback/',
      );
      if (mounted) {
        setState(
            () => message = 'Enviamos um link de recuperação para $address.');
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
                    createMode
                        ? 'Criar nova conta'
                        : 'Gestão de materiais e equipamentos',
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
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error),
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
