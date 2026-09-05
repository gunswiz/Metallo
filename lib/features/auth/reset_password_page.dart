import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/errors.dart';
import 'package:metallo/data/repositories/auth_repository.dart';
import 'package:metallo/shared/widgets/brand_logo.dart';

class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key, required this.authRepository});

  final AuthRepository authRepository;

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final password = TextEditingController();
  final confirmPassword = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() {
    password.dispose();
    confirmPassword.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (password.text.length < 4) {
      setState(
          () => error = 'A nova senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (password.text != confirmPassword.text) {
      setState(() => error = 'As senhas não são iguais.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.authRepository.updatePassword(password.text);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Senha alterada com sucesso.')),
        );
        await widget.authRepository.signOut();
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
                  const Text('Definir nova senha',
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 18),
                  TextField(
                      controller: password,
                      obscureText: true,
                      decoration:
                          const InputDecoration(labelText: 'Nova senha (4+)')),
                  const SizedBox(height: 12),
                  TextField(
                      controller: confirmPassword,
                      obscureText: true,
                      decoration: const InputDecoration(
                          labelText: 'Confirmar nova senha')),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                      onPressed: busy ? null : save,
                      child: busy
                          ? const CircularProgressIndicator(strokeWidth: 2)
                          : const Text('Salvar nova senha')),
                ],
              ),
            ),
          ),
        ),
      );
}
