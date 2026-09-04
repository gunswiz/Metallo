import 'package:flutter/material.dart';

const metalloPrimary = Color(0xFF1687FF);
const metalloSecondary = Color(0xFF55A9FF);
const metalloBackground = Color(0xFF05080D);
const metalloSurface = Color(0xFF111720);
const metalloInputFill = Color(0xFF121820);
const metalloBorder = Color(0xFF2B394B);
const metalloNavigationBackground = Color(0xFF090D13);
const metalloNavigationIndicator = Color(0xFF123A65);

ThemeData metalloTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: metalloPrimary,
    brightness: Brightness.dark,
  ).copyWith(
    primary: metalloPrimary,
    secondary: metalloSecondary,
    surface: metalloSurface,
  );

  return ThemeData(
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: metalloBackground,
    useMaterial3: true,
    appBarTheme: const AppBarTheme(
      backgroundColor: metalloBackground,
      foregroundColor: Colors.white,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: metalloSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: metalloInputFill,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: metalloBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: metalloBorder),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: metalloNavigationBackground,
      indicatorColor: metalloNavigationIndicator,
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
  );
}
