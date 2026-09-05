import 'package:supabase_flutter/supabase_flutter.dart';

class AuthRepository {
  AuthRepository(this.client);

  final SupabaseClient client;

  Stream<AuthState> get onAuthStateChange => client.auth.onAuthStateChange;

  bool get hasCurrentSession => client.auth.currentSession != null;

  String? get currentUserId => client.auth.currentUser?.id;

  String? get currentUserEmail => client.auth.currentUser?.email;

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String fullName,
  }) =>
      client.auth.signUp(
        email: email,
        password: password,
        data: {'full_name': fullName},
      );

  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) =>
      client.auth.signInWithPassword(email: email, password: password);

  Future<void> signOut() => client.auth.signOut();

  Future<void> resetPasswordForEmail(
    String email, {
    required String redirectTo,
  }) =>
      client.auth.resetPasswordForEmail(email, redirectTo: redirectTo);

  Future<UserResponse> updateEmail(String email) =>
      client.auth.updateUser(UserAttributes(email: email));

  Future<UserResponse> updatePassword(String password) =>
      client.auth.updateUser(UserAttributes(password: password));
}
