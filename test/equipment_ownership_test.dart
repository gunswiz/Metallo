import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/repository.dart';

void main() {
  test('existing equipment defaults to company owned', () {
    final info = parseEquipmentOwnership('Revisado em campo');

    expect(info.type, 'owned');
    expect(info.notes, 'Revisado em campo');
  });

  test('rental metadata round-trips without leaking into visible notes', () {
    final stored = buildEquipmentNotes(
      ownershipType: 'rented',
      rentalCompany: 'Locadora & Máquinas',
      rentalEndDate: '2026-12-31',
      notes: 'Furadeira de impacto 220 V',
    );
    final info = parseEquipmentOwnership(stored);

    expect(info.isRented, isTrue);
    expect(info.rentalCompany, 'Locadora & Máquinas');
    expect(info.rentalEndDate, '2026-12-31');
    expect(info.notes, 'Furadeira de impacto 220 V');
    expect(info.notes, isNot(contains('#metallo:')));
  });
}
