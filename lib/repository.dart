import 'package:supabase_flutter/supabase_flutter.dart';

export 'data/models/dashboard_snapshot.dart';
export 'data/models/equipment_asset.dart';
export 'data/models/equipment_ownership.dart';
export 'data/models/material_stock.dart';
export 'data/models/team.dart';

import 'data/models/dashboard_snapshot.dart';
import 'data/models/equipment_asset.dart';
import 'data/repositories/admin_repository.dart';
import 'data/repositories/catalog_repository.dart';
import 'data/repositories/dashboard_repository.dart';
import 'data/repositories/epi_repository.dart';
import 'data/repositories/movement_repository.dart';

class MetalloRepository {
  MetalloRepository(this.client) {
    _dashboard = DashboardRepository(client);
    _catalog = CatalogRepository(client, _dashboard);
    _epi = EpiRepository(client, _dashboard);
    _admin = AdminRepository(client, _dashboard);
    _movement = MovementRepository(client, _dashboard);
  }

  final SupabaseClient client;
  late final DashboardRepository _dashboard;
  late final CatalogRepository _catalog;
  late final EpiRepository _epi;
  late final AdminRepository _admin;
  late final MovementRepository _movement;

  Future<Map<String, dynamic>?> currentProfile() => _admin.currentProfile();
  Future<List<Map<String, dynamic>>> fetchProfiles() => _admin.fetchProfiles();
  Future<List<Map<String, dynamic>>> fetchEpiEmployees() =>
      _epi.fetchEpiEmployees();
  Future<List<Map<String, dynamic>>> fetchEpiItems() => _epi.fetchEpiItems();
  Future<List<Map<String, dynamic>>> fetchEpiStock() => _epi.fetchEpiStock();
  Future<List<Map<String, dynamic>>> fetchEpiDeliveries() =>
      _epi.fetchEpiDeliveries();
  Future<List<Map<String, dynamic>>> fetchEpiRequests() =>
      _epi.fetchEpiRequests();

  Future<void> requestEpiItem({
    required String employeeId,
    required String teamId,
    required String itemId,
    required int quantity,
    String? requestedVariant,
  }) =>
      _epi.requestEpiItem(
        employeeId: employeeId,
        teamId: teamId,
        itemId: itemId,
        quantity: quantity,
        requestedVariant: requestedVariant,
      );

  Future<void> fulfillEpiRequest(String requestId, String stockBatchId) =>
      _epi.fulfillEpiRequest(requestId, stockBatchId);

  Future<void> createEpiEmployee({
    required String fullName,
    required String profession,
    required String teamId,
    String? registrationCode,
    String? shirtSize,
    String? pantsSize,
    String? shoeSize,
  }) =>
      _epi.createEpiEmployee(
        fullName: fullName,
        profession: profession,
        teamId: teamId,
        registrationCode: registrationCode,
        shirtSize: shirtSize,
        pantsSize: pantsSize,
        shoeSize: shoeSize,
      );

  Future<void> updateEpiEmployee({
    required String id,
    required String fullName,
    required String profession,
    required String teamId,
    String? registrationCode,
    String? shirtSize,
    String? pantsSize,
    String? shoeSize,
  }) =>
      _epi.updateEpiEmployee(
        id: id,
        fullName: fullName,
        profession: profession,
        teamId: teamId,
        registrationCode: registrationCode,
        shirtSize: shirtSize,
        pantsSize: pantsSize,
        shoeSize: shoeSize,
      );

  Future<void> renewEmployeeAso(
    String employeeId,
    DateTime examDate,
    DateTime expiryDate,
  ) =>
      _epi.renewEmployeeAso(employeeId, examDate, expiryDate);

  Future<Map<String, dynamic>> fetchEpiEmployeeItemSet(String employeeId) =>
      _epi.fetchEpiEmployeeItemSet(employeeId);

  Future<void> setEpiEmployeeItems(
    String employeeId,
    List<Map<String, dynamic>> lines,
  ) =>
      _epi.setEpiEmployeeItems(employeeId, lines);

  Future<void> createEpiItem({
    required String code,
    required String name,
    required String kind,
    required String unit,
    String? caNumber,
    String? brandModel,
    int minimumStock = 0,
    int? replacementDays,
  }) =>
      _epi.createEpiItem(
        code: code,
        name: name,
        kind: kind,
        unit: unit,
        caNumber: caNumber,
        brandModel: brandModel,
        minimumStock: minimumStock,
        replacementDays: replacementDays,
      );

  Future<void> updateEpiItem({
    required String id,
    required String code,
    required String name,
    required String kind,
    required String unit,
    String? caNumber,
    String? brandModel,
    int minimumStock = 0,
    int? replacementDays,
  }) =>
      _epi.updateEpiItem(
        id: id,
        code: code,
        name: name,
        kind: kind,
        unit: unit,
        caNumber: caNumber,
        brandModel: brandModel,
        minimumStock: minimumStock,
        replacementDays: replacementDays,
      );

  Future<void> deactivateEpiItem(String id) => _epi.deactivateEpiItem(id);

  Future<void> addEpiStock({
    required String itemId,
    required int quantity,
    String? caNumber,
    String? brandModel,
    String? lotNumber,
    String? variant,
  }) =>
      _epi.addEpiStock(
        itemId: itemId,
        quantity: quantity,
        caNumber: caNumber,
        brandModel: brandModel,
        lotNumber: lotNumber,
        variant: variant,
      );

  Future<void> registerEpiDelivery({
    required String employeeId,
    required String itemId,
    required String stockBatchId,
    required int quantity,
    String reason = 'initial',
    String? note,
  }) =>
      _epi.registerEpiDelivery(
        employeeId: employeeId,
        itemId: itemId,
        stockBatchId: stockBatchId,
        quantity: quantity,
        reason: reason,
        note: note,
      );

  Future<void> registerEpiDeliveryBatch({
    required String employeeId,
    required List<Map<String, dynamic>> lines,
    String reason = 'initial',
    String? note,
  }) =>
      _epi.registerEpiDeliveryBatch(
        employeeId: employeeId,
        lines: lines,
        reason: reason,
        note: note,
      );

  Future<void> closeEpiDelivery(String id, String status) =>
      _epi.closeEpiDelivery(id, status);

  Future<DashboardSnapshot> fetchDashboard() => _dashboard.fetchDashboard();
  Future<void> refreshDashboard() => _dashboard.refreshDashboard();
  Stream<DashboardSnapshot> watchDashboard() => _dashboard.watchDashboard();

  Future<List<Map<String, dynamic>>> fetchMaterialCatalog() =>
      _catalog.fetchMaterialCatalog();
  Future<List<Map<String, dynamic>>> fetchEquipmentCatalog() =>
      _catalog.fetchEquipmentCatalog();

  Future<void> updateEquipmentItem({
    required String itemId,
    required String code,
    required String name,
  }) =>
      _catalog.updateEquipmentItem(itemId: itemId, code: code, name: name);

  Future<void> updateEquipmentAsset({
    required String assetId,
    required String assetCode,
    required String? serialNumber,
    required String teamId,
    required String status,
    required String? notes,
    String ownershipType = 'owned',
    String? rentalCompany,
    String? rentalEndDate,
  }) =>
      _catalog.updateEquipmentAsset(
        assetId: assetId,
        assetCode: assetCode,
        serialNumber: serialNumber,
        teamId: teamId,
        status: status,
        notes: notes,
        ownershipType: ownershipType,
        rentalCompany: rentalCompany,
        rentalEndDate: rentalEndDate,
      );

  Future<void> deactivateEquipmentAsset(String assetId) =>
      _catalog.deactivateEquipmentAsset(assetId);

  Future<void> updateMaterialItem({
    required String itemId,
    required String code,
    required String name,
    required String unit,
    String? category,
    String? description,
  }) =>
      _catalog.updateMaterialItem(
        itemId: itemId,
        code: code,
        name: name,
        unit: unit,
        category: category,
        description: description,
      );

  Future<void> deactivateMaterialItem(String itemId) =>
      _catalog.deactivateMaterialItem(itemId);

  Future<void> createMaterial({
    required String code,
    required String name,
    required String teamId,
    required int quantity,
    String unit = 'un',
  }) =>
      _catalog.createMaterial(
        code: code,
        name: name,
        teamId: teamId,
        quantity: quantity,
        unit: unit,
      );

  Future<void> createEquipment({
    required String code,
    required String name,
    required String assetCode,
    required String teamId,
    String? serialNumber,
    String ownershipType = 'owned',
    String? rentalCompany,
    String? rentalEndDate,
    String? notes,
  }) =>
      _catalog.createEquipment(
        code: code,
        name: name,
        assetCode: assetCode,
        teamId: teamId,
        serialNumber: serialNumber,
        ownershipType: ownershipType,
        rentalCompany: rentalCompany,
        rentalEndDate: rentalEndDate,
        notes: notes,
      );

  Future<void> createTeam(String name, String? description) =>
      _admin.createTeam(name, description);
  Future<void> updateTeam(String id, String name, String? description) =>
      _admin.updateTeam(id, name, description);
  Future<void> deleteTeam(String id) => _admin.deleteTeam(id);

  Future<void> createEmployee({
    required String fullName,
    required String email,
    required String password,
    required String role,
    required String teamId,
  }) =>
      _admin.createEmployee(
        fullName: fullName,
        email: email,
        password: password,
        role: role,
        teamId: teamId,
      );

  Future<void> updateProfileAdmin({
    required String userId,
    required String fullName,
    required String role,
    required String? teamId,
    required bool active,
  }) =>
      _admin.updateProfileAdmin(
        userId: userId,
        fullName: fullName,
        role: role,
        teamId: teamId,
        active: active,
      );

  Future<void> deleteEmployee(String userId) => _admin.deleteEmployee(userId);

  Future<void> consumeMaterial({
    required String itemId,
    required String teamId,
    required int quantity,
    String? note,
  }) =>
      _movement.consumeMaterial(
        itemId: itemId,
        teamId: teamId,
        quantity: quantity,
        note: note,
      );

  Future<void> replenishMaterial({
    required String itemId,
    required String centralTeamId,
    required String destinationTeamId,
    required int quantity,
    String? note,
  }) =>
      _movement.replenishMaterial(
        itemId: itemId,
        centralTeamId: centralTeamId,
        destinationTeamId: destinationTeamId,
        quantity: quantity,
        note: note,
      );

  Future<void> transferEquipment({
    required String assetId,
    required String toTeamId,
  }) =>
      _movement.transferEquipment(assetId: assetId, toTeamId: toTeamId);

  Future<void> returnRentedEquipment(EquipmentAsset asset, String? note) =>
      _movement.returnRentedEquipment(asset, note);

  Future<void> sendEquipmentToMaintenance({
    required String assetId,
    String? note,
  }) =>
      _movement.sendEquipmentToMaintenance(assetId: assetId, note: note);

  Future<void> returnEquipmentFromMaintenance({
    required String assetId,
    required String toTeamId,
    String? note,
  }) =>
      _movement.returnEquipmentFromMaintenance(
        assetId: assetId,
        toTeamId: toTeamId,
        note: note,
      );

  Future<List<Map<String, dynamic>>> fetchMaterialConsumption() =>
      _movement.fetchMaterialConsumption();
  Future<List<Map<String, dynamic>>> fetchHistory() => _movement.fetchHistory();

  Future<void> updateMaterialHistory({
    required String id,
    required int quantity,
    required String? originTeamId,
    required String? destinationTeamId,
    required String? note,
  }) =>
      _movement.updateMaterialHistory(
        id: id,
        quantity: quantity,
        originTeamId: originTeamId,
        destinationTeamId: destinationTeamId,
        note: note,
      );

  Future<void> deleteMaterialHistory(String id) =>
      _movement.deleteMaterialHistory(id);

  Future<void> updateAssetHistory({
    required String id,
    required String destinationTeamId,
    required String status,
    required String? note,
  }) =>
      _movement.updateAssetHistory(
        id: id,
        destinationTeamId: destinationTeamId,
        status: status,
        note: note,
      );

  Future<void> deleteAssetHistory(String id) =>
      _movement.deleteAssetHistory(id);

  Future<void> dispose() => _dashboard.dispose();
}
