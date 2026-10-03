class Team {
  final String id;
  final String name;
  final String? description;
  final String locationType;
  final String? worksiteId;
  final String? worksiteName;
  final String? stockTeamId;

  const Team({
    required this.id,
    required this.name,
    this.description,
    this.locationType = 'field',
    this.worksiteId,
    this.worksiteName,
    this.stockTeamId,
  });

  bool get isCentral => locationType == 'central';
  String get physicalStockTeamId => stockTeamId ?? id;
  String get stockLocationLabel => worksiteName ?? name;

  factory Team.fromMap(Map<String, dynamic> m) => Team(
        id: m['id'] as String,
        name: m['name'] as String,
        description: m['description'] as String?,
        locationType: (m['location_type'] as String?) ?? 'field',
        worksiteId: m['worksite_id'] as String?,
        worksiteName: m['worksite_name'] as String?,
        stockTeamId: m['stock_team_id'] as String?,
      );
}
