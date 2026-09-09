String? requiredText(String? value, String label) {
  if (value == null || value.trim().isEmpty) return '$label é obrigatório.';
  return null;
}

String? positiveQuantity(int? value) {
  if (value == null || value <= 0) {
    return 'A quantidade deve ser maior que zero.';
  }
  return null;
}
