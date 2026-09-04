class Team {
  final String id;
  final String name;
  final String? description;
  final String locationType;

  const Team({
    required this.id,
    required this.name,
    this.description,
    this.locationType = 'field',
  });

  bool get isCentral => locationType == 'central';

  factory Team.fromMap(Map<String, dynamic> m) => Team(
        id: m['id'] as String,
        name: m['name'] as String,
        description: m['description'] as String?,
        locationType: (m['location_type'] as String?) ?? 'field',
      );
}
