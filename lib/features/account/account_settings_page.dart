import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/app_update.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/shared/widgets/brand_logo.dart';
import 'package:metallo/features/shell/guide.dart';
import 'package:metallo/features/auth/auth_validation.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage(
      {super.key,
      required this.authRepository,
      required this.role,
      required this.onReplayTutorial,
      this.onStartGuidedPractice});
  final AuthRepository authRepository;
  final String role;
  final Future<void> Function() onReplayTutorial;
  final Future<void> Function(HelpTopic)? onStartGuidedPractice;

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  late final TextEditingController email = TextEditingController(
    text: widget.authRepository.currentUserEmail ?? '',
  );
  final password = TextEditingController();
  final password2 = TextEditingController();
  bool busy = false;
  String? message;
  String? error;

  void _startAction() {
    setState(() {
      busy = true;
      error = null;
      message = null;
    });
  }

  Future<void> changeEmail() async {
    final value = email.text.trim();
    if (value.isEmpty || !value.contains('@')) {
      setState(() => error = 'Informe um e-mail válido.');
      return;
    }
    _startAction();
    try {
      await widget.authRepository.updateEmail(value);
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
    final validationError =
        passwordResetValidation(password.text, password2.text);
    if (validationError != null) {
      setState(() => error = validationError);
      return;
    }
    _startAction();
    try {
      await widget.authRepository.updatePassword(password.text);
      password.clear();
      password2.clear();
      if (mounted) setState(() => message = 'Senha alterada com sucesso.');
    } catch (e) {
      if (mounted) setState(() => error = friendlyError(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _openGuide() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => HelpGuidePage(
        role: widget.role,
        onStartGuidedPractice: widget.onStartGuidedPractice,
      ),
    ));
  }

  Future<void> _replayTutorial() async {
    Navigator.of(context).pop();
    await widget.onReplayTutorial();
  }

  void _checkForUpdate() {
    AppUpdateService.showIfAvailable(context, showUpToDate: true);
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
            _AccountEmailSection(
              controller: email,
              enabled: !busy,
              onChangeEmail: changeEmail,
            ),
            const SizedBox(height: 26),
            _AccountPasswordSection(
              passwordController: password,
              confirmationController: password2,
              enabled: !busy,
              onChangePassword: changePassword,
            ),
            const SizedBox(height: 26),
            _AccountHelpSection(
              enabled: !busy,
              onOpenGuide: _openGuide,
              onReplayTutorial: _replayTutorial,
              onCheckForUpdate: _checkForUpdate,
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

class _AccountEmailSection extends StatelessWidget {
  const _AccountEmailSection({
    required this.controller,
    required this.enabled,
    required this.onChangeEmail,
  });

  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChangeEmail;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Alterar e-mail',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: controller,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(
              labelText: 'Novo e-mail',
              prefixIcon: Icon(Icons.email_outlined),
            ),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: enabled ? onChangeEmail : null,
            icon: const Icon(Icons.mark_email_read_outlined),
            label: const Text('Solicitar alteração de e-mail'),
          ),
        ],
      );
}

class _AccountPasswordSection extends StatelessWidget {
  const _AccountPasswordSection({
    required this.passwordController,
    required this.confirmationController,
    required this.enabled,
    required this.onChangePassword,
  });

  final TextEditingController passwordController;
  final TextEditingController confirmationController;
  final bool enabled;
  final VoidCallback onChangePassword;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Alterar senha',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Nova senha (4+)'),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: confirmationController,
            obscureText: true,
            decoration:
                const InputDecoration(labelText: 'Confirmar nova senha'),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: enabled ? onChangePassword : null,
            icon: const Icon(Icons.lock_reset),
            label: const Text('Alterar senha'),
          ),
        ],
      );
}

class _AccountHelpSection extends StatelessWidget {
  const _AccountHelpSection({
    required this.enabled,
    required this.onOpenGuide,
    required this.onReplayTutorial,
    required this.onCheckForUpdate,
  });

  final bool enabled;
  final VoidCallback onOpenGuide;
  final VoidCallback onReplayTutorial;
  final VoidCallback onCheckForUpdate;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Ajuda',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            onPressed: enabled ? onOpenGuide : null,
            icon: const Icon(Icons.menu_book_outlined),
            label: const Text('Abrir guia prático'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: enabled ? onReplayTutorial : null,
            icon: const Icon(Icons.school_outlined),
            label: const Text('Ver tutorial do aplicativo novamente'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: enabled ? onCheckForUpdate : null,
            icon: const Icon(Icons.system_update_alt_rounded),
            label: const Text('Verificar atualização'),
          ),
        ],
      );
}
