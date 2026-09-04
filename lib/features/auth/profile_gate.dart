part of '../../app.dart';

class ProfileGate extends StatefulWidget {
  const ProfileGate({super.key});

  @override
  State<ProfileGate> createState() => _ProfileGateState();
}

class _ProfileGateState extends State<ProfileGate> {
  late final MetalloRepository repo =
      MetalloRepository(Supabase.instance.client);
  late Future<Map<String, dynamic>?> profile = repo.currentProfile();

  @override
  void dispose() {
    repo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>?>(
      future: profile,
      builder: (context, snap) {
        if (snap.hasError) {
          return ErrorPage(
            message: friendlyError(snap.error),
            onRetry: () => setState(() => profile = repo.currentProfile()),
          );
        }
        if (!snap.hasData) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        final p = snap.data!;
        if (p['active'] != true) {
          return PendingAccessPage(
            onRetry: () => setState(() => profile = repo.currentProfile()),
          );
        }
        return MainShell(profile: p);
      },
    );
  }
}
