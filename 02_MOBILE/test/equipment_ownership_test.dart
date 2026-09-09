import 'package:flutter_test/flutter_test.dart';
import 'package:metallo/07_TIPOS_E_MODELOS/equipment_ownership.dart';

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
      rentalStartDate: '2026-09-01',
      rentalEndDate: '2026-12-31',
      notes: 'Furadeira de impacto 220 V',
    );
    final info = parseEquipmentOwnership(stored);

    expect(info.isRented, isTrue);
    expect(info.rentalCompany, 'Locadora & Máquinas');
    expect(info.rentalStartDate, '2026-09-01');
    expect(info.rentalEndDate, '2026-12-31');
    expect(info.notes, 'Furadeira de impacto 220 V');
    expect(info.notes, isNot(contains('#metallo:')));
  });

  test('normalized columns take precedence over legacy metadata', () {
    final info = equipmentOwnershipFromMap({
      'ownership_type': 'rented',
      'rental_company': 'Locadora atual',
      'rental_start_date': '2026-09-02',
      'rental_end_date': '2026-10-02',
      'user_notes': 'Observação visível',
      'notes': '#metallo:ownership=owned\nTexto antigo',
    });

    expect(info.isRented, isTrue);
    expect(info.rentalCompany, 'Locadora atual');
    expect(info.notes, 'Observação visível');
  });
}
