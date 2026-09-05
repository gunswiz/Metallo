import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/core/formatters.dart';
import 'package:metallo/core/theme.dart';
import 'package:metallo/data/models/dashboard_snapshot.dart';
import 'package:metallo/data/models/equipment_asset.dart';
import 'package:metallo/data/models/material_stock.dart';
import 'package:metallo/data/models/team.dart';
import 'package:metallo/data/repositories/admin_repository.dart';
import 'package:metallo/data/repositories/dashboard_repository.dart';
import 'package:metallo/data/repositories/epi_repository.dart';
import 'package:metallo/data/repositories/movement_repository.dart';
import 'package:metallo/shared/widgets/brand_logo.dart';
import 'package:metallo/shared/widgets/empty_state.dart';
import 'package:metallo/shared/widgets/error_state.dart';
import 'package:metallo/shared/widgets/status_badge.dart';
import 'package:metallo/shared/widgets/summary_tile.dart';
import 'package:metallo/features/materials/dialogs.dart';
import 'package:metallo/features/epi/epi_shell.dart';
import 'package:metallo/features/dashboard/dashboard_view_data.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.dashboardRepository,
    required this.adminRepository,
    required this.epiRepository,
    required this.movementRepository,
    required this.stream,
    required this.role,
    required this.userTeamId,
  });

  final DashboardRepository dashboardRepository;
  final AdminRepository adminRepository;
  final EpiRepository epiRepository;
  final MovementRepository movementRepository;
  final Stream<DashboardSnapshot> stream;
  final String role;
  final String? userTeamId;

  bool get canOperate =>
      role == 'admin' || role == 'engineer' || role == 'leader';

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<DashboardSnapshot>(
      stream: stream,
      builder: (context, snap) {
        if (snap.hasError) return ErrorState(error: snap.error);
        if (!snap.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snap.data!;

        return RefreshIndicator(
          onRefresh: dashboardRepository.refreshDashboard,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 30),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF111A25), Color(0xFF07101B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  border: Border.all(color: const Color(0xFF164C80)),
                ),
                child: Column(
                  children: [
                    const BrandLogo(height: 68),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.groups_2_outlined,
                            value: '${dashboardTeamCount(data.teams)}',
                            label: 'Equipes',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.inventory_2_outlined,
                            value: '${dashboardMaterialCount(data.materials)}',
                            label: 'Materiais',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.handyman_outlined,
                            value: '${data.equipment.length}',
                            label: 'Equipamentos',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (role == 'admin' || role == 'engineer') ...[
                Card(
                  margin: const EdgeInsets.only(bottom: 20),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => EpiManagementShell(
                          repo: epiRepository,
                          adminRepository: adminRepository,
                          teams: data.teams,
                          role: role,
                        ),
                      ),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(18),
                      child: Row(
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              color: const Color(0xFF0B3158),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Icon(Icons.health_and_safety_outlined,
                                color: Color(0xFF2694FF), size: 30),
                          ),
                          const SizedBox(width: 14),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('EPI e Pessoas',
                                    style: TextStyle(
                                        fontSize: 19,
                                        fontWeight: FontWeight.w900)),
                                SizedBox(height: 4),
                                Text(
                                  'Entregas por equipe, fardas e itens pessoais',
                                  style: TextStyle(color: Colors.white60),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right_rounded,
                              color: Colors.white38),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
              const Text(
                'Equipes e inventário',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              const Text(
                'Cada item aparece na equipe onde está fisicamente.',
                style: TextStyle(color: Colors.white60),
              ),
              const SizedBox(height: 14),
              for (final team in data.teams)
                TeamOverviewCard(
                  dashboardRepository: dashboardRepository,
                  adminRepository: adminRepository,
                  movementRepository: movementRepository,
                  team: team,
                  materials: dashboardTeamMaterials(data.materials, team.id),
                  equipment: dashboardTeamEquipment(data.equipment, team.id),
                  role: role,
                  userTeamId: userTeamId,
                ),
            ],
          ),
        );
      },
    );
  }
}

class TeamOverviewCard extends StatelessWidget {
  const TeamOverviewCard(
      {super.key,
      required this.dashboardRepository,
      required this.adminRepository,
      required this.movementRepository,
      required this.team,
      required this.materials,
      required this.equipment,
      required this.role,
      required this.userTeamId});
  final DashboardRepository dashboardRepository;
  final AdminRepository adminRepository;
  final MovementRepository movementRepository;
  final Team team;
  final List<MaterialStock> materials;
  final List<EquipmentAsset> equipment;
  final String role;
  final String? userTeamId;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => TeamDetailPage(
                    dashboardRepository: dashboardRepository,
                    adminRepository: adminRepository,
                    movementRepository: movementRepository,
                    team: team,
                    materials: materials,
                    equipment: equipment,
                    role: role,
                    userTeamId: userTeamId))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            CircleAvatar(
                backgroundColor: const Color(0xFF0E3157),
                child: Icon(
                    team.isCentral
                        ? Icons.warehouse_outlined
                        : Icons.groups_2_outlined,
                    color: metalloAccent)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(team.name,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 7),
                  Wrap(spacing: 12, runSpacing: 6, children: [
                    _CountChip(
                        icon: Icons.inventory_2_outlined,
                        text: '${materials.length} materiais'),
                    _CountChip(
                        icon: Icons.handyman_outlined,
                        text: '${equipment.length} equipamentos'),
                  ]),
                ])),
            const Icon(Icons.chevron_right_rounded, color: Colors.white38),
          ]),
        ),
      ),
    );
  }
}

class _CountChip extends StatelessWidget {
  const _CountChip({required this.icon, required this.text});
  final IconData icon;
  final String text;
  @override
  Widget build(BuildContext context) =>
      Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 15, color: metalloAccent),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(color: Colors.white60, fontSize: 12))
      ]);
}

class TeamDetailPage extends StatefulWidget {
  const TeamDetailPage(
      {super.key,
      required this.dashboardRepository,
      required this.adminRepository,
      required this.movementRepository,
      required this.team,
      required this.materials,
      required this.equipment,
      required this.role,
      required this.userTeamId});
  final DashboardRepository dashboardRepository;
  final AdminRepository adminRepository;
  final MovementRepository movementRepository;
  final Team team;
  final List<MaterialStock> materials;
  final List<EquipmentAsset> equipment;
  final String role;
  final String? userTeamId;
  @override
  State<TeamDetailPage> createState() => _TeamDetailPageState();
}

class _TeamDetailPageState extends State<TeamDetailPage> {
  int tab = 0;
  String query = '';
  late Future<List<Map<String, dynamic>>> people;
  late List<MaterialStock> materials;
  @override
  void initState() {
    super.initState();
    people = widget.adminRepository.fetchProfiles();
    materials = widget.materials;
  }

  bool get canConsume =>
      widget.role == 'admin' ||
      widget.role == 'engineer' ||
      widget.team.id == widget.userTeamId;
  Future<void> registerConsumption(MaterialStock material) async {
    await showMaterialQuantityDialog(context,
        title: 'Consumo de ${material.name}',
        maximum: material.quantity,
        actionLabel: 'Registrar consumo',
        onConfirm: (quantity, note, _) => widget.movementRepository
            .consumeMaterial(
                itemId: material.itemId,
                teamId: widget.team.id,
                quantity: quantity,
                note: note));
    if (!mounted) return;
    final updated = await widget.dashboardRepository.fetchDashboard();
    if (mounted) {
      setState(() => materials =
          dashboardTeamMaterials(updated.materials, widget.team.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredMaterials = filterDashboardMaterials(materials, query);
    final filteredEquipment = filterDashboardEquipment(widget.equipment, query);
    final tabContent = switch (tab) {
      0 => _TeamMaterialsList(
          materials: filteredMaterials,
          canConsume: canConsume,
          onConsume: registerConsumption,
        ),
      1 => _TeamEquipmentList(equipment: filteredEquipment),
      _ => _TeamPeopleList(
          people: people,
          teamId: widget.team.id,
          query: query,
        ),
    };
    return Scaffold(
        appBar: AppBar(title: Text(widget.team.name)),
        body: Column(children: [
          Padding(
              padding: const EdgeInsets.all(16),
              child: SegmentedButton<int>(segments: const [
                ButtonSegment(
                    value: 0,
                    icon: Icon(Icons.inventory_2_outlined),
                    label: Text('Materiais')),
                ButtonSegment(
                    value: 1,
                    icon: Icon(Icons.handyman_outlined),
                    label: Text('Equipamentos')),
                ButtonSegment(
                    value: 2,
                    icon: Icon(Icons.people_outline),
                    label: Text('Integrantes'))
              ], selected: {
                tab
              }, onSelectionChanged: (v) => setState(() => tab = v.first))),
          Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: TextField(
                  onChanged: (v) => setState(() => query = v),
                  decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: teamDetailSearchHint(tab)))),
          Expanded(child: tabContent),
        ]));
  }
}

class _TeamMaterialsList extends StatelessWidget {
  const _TeamMaterialsList({
    required this.materials,
    required this.canConsume,
    required this.onConsume,
  });

  final List<MaterialStock> materials;
  final bool canConsume;
  final ValueChanged<MaterialStock> onConsume;

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: materials.length,
        itemBuilder: (_, index) {
          final material = materials[index];
          return Card(
            child: ListTile(
              title: Text(material.name),
              subtitle: Text(
                '${material.code} • ${material.quantity} ${material.unit} disponíveis',
              ),
              trailing: canConsume
                  ? IconButton(
                      tooltip: 'Registrar consumo',
                      icon: const Icon(
                        Icons.remove_circle_outline,
                        color: metalloAccent,
                      ),
                      onPressed: material.quantity > 0
                          ? () => onConsume(material)
                          : null,
                    )
                  : Text(
                      '${material.quantity} ${material.unit}',
                      style: const TextStyle(
                        color: metalloAccent,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
              onTap: canConsume && material.quantity > 0
                  ? () => onConsume(material)
                  : null,
            ),
          );
        },
      );
}

class _TeamEquipmentList extends StatelessWidget {
  const _TeamEquipmentList({required this.equipment});

  final List<EquipmentAsset> equipment;

  @override
  Widget build(BuildContext context) => ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: equipment.length,
        itemBuilder: (_, index) {
          final asset = equipment[index];
          return Card(
            child: ListTile(
              title: Text(asset.name),
              subtitle: Text('${asset.code} • Patrimônio ${asset.assetCode}'),
              trailing: StatusBadge(status: asset.status),
            ),
          );
        },
      );
}

class _TeamPeopleList extends StatelessWidget {
  const _TeamPeopleList({
    required this.people,
    required this.teamId,
    required this.query,
  });

  final Future<List<Map<String, dynamic>>> people;
  final String teamId;
  final String query;

  @override
  Widget build(BuildContext context) =>
      FutureBuilder<List<Map<String, dynamic>>>(
        future: people,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final filteredPeople =
              filterDashboardTeamPeople(snapshot.data!, teamId, query);
          if (filteredPeople.isEmpty) {
            return const EmptyState(
              icon: Icons.people_outline,
              title: 'Nenhum integrante',
              subtitle: 'Nenhum usuário está atribuído a este local.',
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: filteredPeople.length,
            itemBuilder: (_, index) {
              final person = filteredPeople[index];
              return Card(
                child: ListTile(
                  leading:
                      const CircleAvatar(child: Icon(Icons.person_outline)),
                  title: Text(
                    person['full_name']?.toString() ?? 'Usuário',
                  ),
                  subtitle: Text(
                    roleLabel(person['role']?.toString() ?? 'collaborator'),
                  ),
                ),
              );
            },
          );
        },
      );
}
