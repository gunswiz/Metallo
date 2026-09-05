String? accountCreationValidation(String name, String password) {
  if (name.trim().isEmpty) return 'Informe seu nome.';
  if (password.length < 4) {
    return 'A senha precisa ter pelo menos 4 caracteres.';
  }
  return null;
}

String? recoveryEmailValidation(String email) {
  final normalizedEmail = email.trim();
  if (normalizedEmail.isEmpty || !normalizedEmail.contains('@')) {
    return 'Informe seu e-mail para recuperar a senha.';
  }
  return null;
}

String? passwordResetValidation(String password, String confirmation) {
  if (password.length < 4) {
    return 'A nova senha precisa ter pelo menos 4 caracteres.';
  }
  if (password != confirmation) return 'As senhas não são iguais.';
  return null;
}
