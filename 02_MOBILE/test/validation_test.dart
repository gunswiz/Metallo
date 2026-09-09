import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/validation.dart';

void main() {
  test('required text', () {
    expect(requiredText('', 'Nome'), isNotNull);
    expect(requiredText('Disco de corte', 'Nome'), isNull);
  });

  test('positive quantity', () {
    expect(positiveQuantity(0), isNotNull);
    expect(positiveQuantity(10), isNull);
  });
}
