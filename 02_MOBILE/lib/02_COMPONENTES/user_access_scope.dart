import 'dart:async';
import 'package:flutter/material.dart';
import 'package:metallo/04_FUNCOES_E_LOGICA/user_access.dart';
import 'package:metallo/06_ACESSO_A_DADOS/admin_repository.dart';

class UserAccessScope extends InheritedWidget {
  const UserAccessScope(
      {super.key, required this.access, required super.child});
  final UserAccess access;
  static UserAccess of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<UserAccessScope>()?.access ??
      const UserAccess();
  @override
  bool updateShouldNotify(UserAccessScope oldWidget) =>
      access != oldWidget.access;
}

// Above the Navigator, so dialogs and pushed routes receive permission changes too.
class UserAccessHost extends StatefulWidget {
  const UserAccessHost({super.key, required this.repo, required this.child});
  final AdminRepository repo;
  final Widget child;
  @override
  State<UserAccessHost> createState() => _UserAccessHostState();
}

class _UserAccessHostState extends State<UserAccessHost> {
  StreamSubscription<dynamic>? _auth;
  Stream<Map<String, dynamic>?>? _profile;
  String? _userId;
  void _load() {
    final id = widget.repo.client.auth.currentUser?.id;
    if (_profile != null && id == _userId) return;
    _userId = id;
    _profile = widget.repo.watchCurrentProfile();
  }

  @override
  void initState() {
    super.initState();
    _load();
    _auth = widget.repo.client.auth.onAuthStateChange.listen((_) {
      if (mounted) setState(_load);
    });
  }

  @override
  void dispose() {
    _auth?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => StreamBuilder<Map<String, dynamic>?>(
        key: ValueKey(_userId),
        stream: _profile,
        builder: (context, snapshot) => UserAccessScope(
          access:
              UserAccess.fromProfile(snapshot.hasError ? null : snapshot.data),
          child: widget.child,
        ),
      );
}
