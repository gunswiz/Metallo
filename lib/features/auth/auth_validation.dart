String? strongPasswordValidation(
  String password, {
  String subject = 'A senha',
}) {
  if (password.length < 12) {
    return '$subject precisa ter pelo menos 12 caracteres.';
  }
  if (!RegExp(r'[A-Z]').hasMatch(password) ||
      !RegExp(r'[a-z]').hasMatch(password) ||
      !RegExp(r'[0-9]').hasMatch(password) ||
      !RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
    return '$subject precisa ter letra maiúscula, minúscula, número e símbolo.';
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
  final passwordError =
      strongPasswordValidation(password, subject: 'A nova senha');
  if (passwordError != null) return passwordError;
  if (password != confirmation) return 'As senhas não são iguais.';
  return null;
}
