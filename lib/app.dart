import 'dart:async';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/app_update.dart';
import 'core/errors.dart';
import 'core/formatters.dart';
import 'core/theme.dart';
import 'core/validation.dart';
import 'epi_module.dart';
import 'repository.dart';
import 'shared/widgets/brand_logo.dart';
import 'shared/widgets/empty_state.dart';
import 'shared/widgets/equipment_ownership_badge.dart';
import 'shared/widgets/error_page.dart';
import 'shared/widgets/error_state.dart';
import 'shared/widgets/guided_practice_card.dart';
import 'shared/widgets/role_badge.dart';
import 'shared/widgets/status_badge.dart';
import 'shared/widgets/summary_tile.dart';
import 'shared/widgets/ui_action_lock.dart';

part 'features/auth/startup_splash.dart';
part 'features/auth/auth_gate.dart';
part 'features/auth/profile_gate.dart';
part 'features/auth/login_page.dart';
part 'features/auth/reset_password_page.dart';
part 'features/auth/pending_access_page.dart';
part 'features/shell/main_shell.dart';
part 'features/shell/tutorial.dart';
part 'features/shell/guide.dart';
part 'features/legacy.dart';

class MetalloApp extends StatelessWidget {
  const MetalloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Metallo',
      theme: metalloTheme(),
      builder: (context, child) {
        final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
        return Stack(
          children: [
            Positioned.fill(child: child ?? const SizedBox.shrink()),
            if (!keyboardOpen)
              const Positioned(
                right: 7,
                bottom: 4,
                child: IgnorePointer(
                  child: SafeArea(
                    top: false,
                    left: false,
                    child: Text(
                      'Criado por WM',
                      style: TextStyle(
                        color: Color(0x336F8298),
                        fontSize: 7,
                        fontWeight: FontWeight.w400,
                        letterSpacing: 0.1,
                        decoration: TextDecoration.none,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
      home: const StartupSplash(),
    );
  }
}
