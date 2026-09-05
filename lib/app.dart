import 'package:flutter/material.dart';
import 'core/theme.dart';
import 'features/auth/startup_splash.dart';

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
