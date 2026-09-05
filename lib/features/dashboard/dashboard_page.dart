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
                            value:
                                '${data.teams.where((t) => !t.isCentral).length}',
                            label: 'Equipes',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SummaryTile(
                            icon: Icons.inventory_2_outlined,
                            value:
                                '${data.materials.map((m) => m.itemId).toSet().length}',
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
                  materials:
                      data.materials.where((m) => m.teamId == team.id).toList(),
                  equipment:
                      data.equipment.where((e) => e.teamId == team.id).toList(),
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
          updated.materials.where((m) => m.teamId == widget.team.id).toList());
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = query.trim().toLowerCase();
    final mats = materials
        .where(
            (m) => q.isEmpty || '${m.code} ${m.name}'.toLowerCase().contains(q))
        .toList();
    final eqs = widget.equipment
        .where((e) =>
            q.isEmpty ||
            '${e.code} ${e.name} ${e.assetCode}'.toLowerCase().contains(q))
        .toList();
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
                      hintText: tab == 0
                          ? 'Pesquisar material por nome ou código'
                          : tab == 1
                              ? 'Pesquisar equipamento, código ou patrimônio'
                              : 'Pesquisar integrante'))),
          Expanded(
              child: tab == 0
                  ? ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: mats.length,
                      itemBuilder: (_, i) {
                        final m = mats[i];
                        return Card(
                            child: ListTile(
                                title: Text(m.name),
                                subtitle: Text(
                                    '${m.code} • ${m.quantity} ${m.unit} disponíveis'),
                                trailing: canConsume
                                    ? IconButton(
                                        tooltip: 'Registrar consumo',
                                        icon: const Icon(
                                            Icons.remove_circle_outline,
                                            color: metalloAccent),
                                        onPressed: m.quantity > 0
                                            ? () => registerConsumption(m)
                                            : null)
                                    : Text('${m.quantity} ${m.unit}',
                                        style: const TextStyle(
                                            color: metalloAccent,
                                            fontWeight: FontWeight.w900)),
                                onTap: canConsume && m.quantity > 0
                                    ? () => registerConsumption(m)
                                    : null));
                      })
                  : tab == 1
                      ? ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: eqs.length,
                          itemBuilder: (_, i) {
                            final e = eqs[i];
                            return Card(
                                child: ListTile(
                                    title: Text(e.name),
                                    subtitle: Text(
                                        '${e.code} • Patrimônio ${e.assetCode}'),
                                    trailing: StatusBadge(status: e.status)));
                          })
                      : FutureBuilder<List<Map<String, dynamic>>>(
                          future: people,
                          builder: (context, snap) {
                            if (!snap.hasData) {
                              return const Center(
                                  child: CircularProgressIndicator());
                            }
                            final rows = snap.data!
                                .where((u) =>
                                    u['team_id']?.toString() ==
                                        widget.team.id &&
                                    (q.isEmpty ||
                                        (u['full_name']
                                                ?.toString()
                                                .toLowerCase()
                                                .contains(q) ??
                                            false)))
                                .toList();
                            if (rows.isEmpty) {
                              return const EmptyState(
                                  icon: Icons.people_outline,
                                  title: 'Nenhum integrante',
                                  subtitle:
                                      'Nenhum usuário está atribuído a este local.');
                            }
                            return ListView.builder(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 16),
                                itemCount: rows.length,
                                itemBuilder: (_, i) {
                                  final u = rows[i];
                                  return Card(
                                      child: ListTile(
                                          leading: const CircleAvatar(
                                              child:
                                                  Icon(Icons.person_outline)),
                                          title: Text(
                                              u['full_name']?.toString() ??
                                                  'Usuário'),
                                          subtitle: Text(roleLabel(
                                              u['role']?.toString() ??
                                                  'collaborator'))));
                                });
                          })),
        ]));
  }
}
