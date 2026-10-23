import 'package:flutter/material.dart';
import 'package:metallo/07_TIPOS_E_MODELOS/team.dart';

/// O início apresenta poucas equipes; busca e expansão mantêm todas acessíveis.
class TeamOverviewSection extends StatefulWidget {
  const TeamOverviewSection(
      {super.key,
      required this.teams,
      required this.itemBuilder,
      this.userTeamId});

  final List<Team> teams;
  final String? userTeamId;
  final Widget Function(Team) itemBuilder;

  @override
  State<TeamOverviewSection> createState() => _TeamOverviewSectionState();
}

class _TeamOverviewSectionState extends State<TeamOverviewSection> {
  final _search = TextEditingController();
  int _limit = 3;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  String _normalize(String value) {
    const from = 'áàâãäéèêëíìîïóòôõöúùûüç';
    const to = 'aaaaaeeeeiiiiooooouuuuc';
    var result = value.trim().toLowerCase();
    for (var i = 0; i < from.length; i++) {
      result = result.replaceAll(from[i], to[i]);
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final query = _normalize(_search.text);
    final matches = widget.teams
        .where((team) => _normalize('${team.name} ${team.worksiteName ?? ''}')
            .contains(query))
        .toList();
    final ordered = [
      ...matches.where((team) => team.id == widget.userTeamId),
      ...matches
          .where((team) => team.id != widget.userTeamId && team.isCentral),
      ...matches
          .where((team) => team.id != widget.userTeamId && !team.isCentral),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('Equipes e inventário',
          style: TextStyle(fontSize: 21, fontWeight: FontWeight.w700)),
      const SizedBox(height: 6),
      const Text('Escolha uma equipe para consultar os itens.',
          style: TextStyle(color: Colors.white60)),
      const SizedBox(height: 16),
      if (widget.teams.isNotEmpty) ...[
        TextField(
          controller: _search,
          onChanged: (_) => setState(() => _limit = 3),
          decoration: InputDecoration(
              labelText: 'Buscar equipe ou obra',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: query.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Limpar busca',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(() {
                            _search.clear();
                            _limit = 3;
                          }))),
        ),
        const SizedBox(height: 12),
        Text(
            '${ordered.length} ${ordered.length == 1 ? 'equipe encontrada' : 'equipes encontradas'}',
            style: const TextStyle(color: Colors.white60, fontSize: 13)),
        const SizedBox(height: 12),
      ],
      if (ordered.isEmpty)
        Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Text(query.isEmpty
                ? 'Nenhuma equipe cadastrada.'
                : 'Nenhuma equipe encontrada. Tente outro nome.')),
      for (final team in ordered.take(_limit)) widget.itemBuilder(team),
      if (ordered.length > _limit)
        OutlinedButton.icon(
            onPressed: () => setState(() => _limit += 6),
            icon: const Icon(Icons.expand_more),
            label: Text('Ver mais equipes (${ordered.length - _limit})')),
      if (_limit > 3 && ordered.length > 3)
        TextButton.icon(
            onPressed: () => setState(() => _limit = 3),
            icon: const Icon(Icons.expand_less),
            label: const Text('Mostrar menos')),
    ]);
  }
}
