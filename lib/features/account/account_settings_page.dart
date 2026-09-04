part of '../../app.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage(
      {super.key,
      required this.role,
      required this.onReplayTutorial,
      this.onStartGuidedPractice});
  final String role;
  final Future<void> Function() onReplayTutorial;
  final Future<void> Function(HelpTopic)? onStartGuidedPractice;

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
      if (mounted) {
        setState(() => message =
            'Solicitação enviada. Confirme a alteração pelos e-mails de segurança enviados pelo Supabase.');
      }
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
  void dispose() {
    email.dispose();
    password.dispose();
    password2.dispose();
    super.dispose();
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
              Text(message!, style: const TextStyle(color: metalloSuccess)),
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
