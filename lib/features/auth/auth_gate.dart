part of '../../app.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (snapshot.data?.event == AuthChangeEvent.passwordRecovery) {
          return const ResetPasswordPage();
        }
        if (auth.currentSession == null) return const LoginPage();
        return const ProfileGate();
      },
    );
  }
}
